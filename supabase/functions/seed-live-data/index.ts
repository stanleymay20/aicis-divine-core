import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resilientCall, structuredLog, handleCors, corsHeaders, errorResponse, jsonResponse } from "../_shared/resilience.ts";

const FN = "seed-live-data";

// Define interfaces for data structures
interface GDACSEvent {
  eventtype: string;
  eventname: string;
  country: string;
  fromdate: string;
  todate: string;
  alertlevel: string;
  severity: { severity: number; severityUnit: string };
  url: string;
  description: string;
}

interface EONETEvent {
  id: string;
  title: string;
  description?: string;
  categories: { id: string; title: string }[];
  sources: { id: string; url: string }[];
  geometry: { date: string; type: string; coordinates: number[] }[];
}

interface ReliefWebDisaster {
  id: number;
  fields: {
    name: string;
    status: string;
    date: { original: string };
    country: { name: string; iso3: string }[];
    type: { name: string }[];
    primary_type: { name: string };
    description?: string;
  };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const results = { crises: 0, alerts: 0, intel_events: 0, security_incidents: 0, critical_alerts: 0, errors: [] as string[] };

  try {
    structuredLog('info', FN, 'Starting live data population');

    // 1. NASA EONET
    await resilientCall(`${FN}:eonet`, async () => {
      const resp = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50");
      if (!resp.ok) throw new Error(`EONET: ${resp.status}`);
      const data = await resp.json();
      const events: EONETEvent[] = data.events || [];

      for (const event of events) {
        const severity = event.categories[0]?.id === "wildfires" ? 8 : event.categories[0]?.id === "severeStorms" ? 7 : 5;
        const { error: crisisError } = await supabase.from("crisis_events").upsert({
          id: `eonet-${event.id}`, kind: event.categories[0]?.title || "Natural Event",
          region: event.title.split(" - ")[0] || "Global", severity, status: "monitoring",
          details_md: `## ${event.title}\n\n${event.description || "Active natural event detected by NASA EONET."}`,
          opened_at: event.geometry[0]?.date || new Date().toISOString(),
        }, { onConflict: "id" });
        if (!crisisError) results.crises++;

        await supabase.from("intel_events").insert({
          division: "crisis", event_type: "natural_disaster",
          severity: severity >= 7 ? "critical" : "warning",
          title: event.title, description: event.description || `${event.categories[0]?.title} event`,
          payload: { source: "NASA_EONET", event_id: event.id, category: event.categories[0]?.title },
          source_system: "NASA EONET",
        });
        results.intel_events++;
      }
    }, { maxRetries: 1, timeoutMs: 20000 }).catch(e => results.errors.push(`EONET: ${(e as Error).message}`));

    // 2. GDACS
    await resilientCall(`${FN}:gdacs`, async () => {
      const resp = await fetch("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?limit=30&orderby=severity:desc");
      if (!resp.ok) throw new Error(`GDACS: ${resp.status}`);
      const text = await resp.text();
      const events = parseGDACSXML(text);

      for (const event of events) {
        const severityMap: Record<string, number> = { "Red": 9, "Orange": 7, "Green": 4 };
        const severity = severityMap[event.alertlevel] || 5;
        const { error } = await supabase.from("critical_alerts").upsert({
          id: `gdacs-${event.eventtype}-${event.fromdate}`, headline: event.eventname,
          level: event.alertlevel?.toLowerCase() || "warning", severity, country: event.country,
          event_type: event.eventtype, meta: { source: "GDACS", url: event.url },
          triggered_at: event.fromdate,
        }, { onConflict: "id" });
        if (!error) results.critical_alerts++;
      }
    }, { maxRetries: 1, timeoutMs: 15000 }).catch(e => results.errors.push(`GDACS: ${(e as Error).message}`));

    // 3. ReliefWeb
    await resilientCall(`${FN}:reliefweb`, async () => {
      const resp = await fetch("https://api.reliefweb.int/v1/disasters?appname=aicis&limit=30&preset=latest&fields[include][]=name&fields[include][]=status&fields[include][]=date&fields[include][]=country&fields[include][]=type&fields[include][]=primary_type");
      if (!resp.ok) throw new Error(`ReliefWeb: ${resp.status}`);
      const data = await resp.json();
      const disasters: ReliefWebDisaster[] = data.data || [];

      for (const disaster of disasters) {
        const country = disaster.fields.country?.[0]?.name || "Global";
        const iso3 = disaster.fields.country?.[0]?.iso3;
        const type = disaster.fields.primary_type?.name || disaster.fields.type?.[0]?.name || "Disaster";

        const { error: alertError } = await supabase.from("alerts").insert({
          title: disaster.fields.name, message: `${type} affecting ${country}. Status: ${disaster.fields.status}`,
          severity: disaster.fields.status === "ongoing" ? "critical" : "high",
          division: "crisis", country, metadata: { source: "ReliefWeb", disaster_id: disaster.id, iso3, type },
        });
        if (!alertError) results.alerts++;

        if (disaster.fields.status === "ongoing") {
          const { error: secError } = await supabase.from("security_incidents").insert({
            event_type: "humanitarian_crisis", severity: 7, title: disaster.fields.name,
            summary: `${type} affecting ${country}`, country, iso3, source: "ReliefWeb",
            start_time: disaster.fields.date?.original || new Date().toISOString(),
            raw: { disaster_id: disaster.id, type },
          });
          if (!secError) results.security_incidents++;
        }
      }
    }, { maxRetries: 1, timeoutMs: 15000 }).catch(e => results.errors.push(`ReliefWeb: ${(e as Error).message}`));

    // 4. WHO Disease Outbreaks
    await resilientCall(`${FN}:who`, async () => {
      const resp = await fetch("https://www.who.int/feeds/entity/csr/don/en/rss.xml");
      if (!resp.ok) throw new Error(`WHO: ${resp.status}`);
      const text = await resp.text();
      const outbreaks = parseWHORSS(text);

      for (const outbreak of outbreaks.slice(0, 20)) {
        const { error } = await supabase.from("intel_events").insert({
          division: "health", event_type: "disease_outbreak",
          severity: outbreak.title.toLowerCase().includes("ebola") || outbreak.title.toLowerCase().includes("cholera") ? "critical" : "warning",
          title: outbreak.title, description: outbreak.description,
          payload: { source: "WHO", link: outbreak.link, pubDate: outbreak.pubDate },
          source_system: "WHO DON",
        });
        if (!error) results.intel_events++;
      }
    }, { maxRetries: 1, timeoutMs: 15000 }).catch(e => results.errors.push(`WHO: ${(e as Error).message}`));

    // 5. USGS Earthquakes
    await resilientCall(`${FN}:usgs`, async () => {
      const resp = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson");
      if (!resp.ok) throw new Error(`USGS: ${resp.status}`);
      const data = await resp.json();
      const quakes = data.features || [];

      for (const quake of quakes) {
        const mag = quake.properties.mag;
        const place = quake.properties.place;
        const coords = quake.geometry.coordinates;

        const { error: crisisError } = await supabase.from("crisis_events").upsert({
          id: `usgs-${quake.id}`, kind: "Earthquake", region: place,
          severity: Math.min(Math.round(mag), 10), status: "monitoring",
          details_md: `## Magnitude ${mag} Earthquake\n\n**Location:** ${place}\n**Depth:** ${coords[2]} km`,
          opened_at: new Date(quake.properties.time).toISOString(),
        }, { onConflict: "id" });
        if (!crisisError) results.crises++;

        if (mag >= 5.5) {
          const { error: alertError } = await supabase.from("alerts").insert({
            title: `M${mag} Earthquake: ${place}`,
            message: `Significant seismic activity. Magnitude ${mag} at depth ${coords[2]}km.`,
            severity: mag >= 7 ? "critical" : "high", division: "crisis",
            country: extractCountryFromPlace(place),
            metadata: { source: "USGS", quake_id: quake.id, magnitude: mag, depth: coords[2] },
          });
          if (!alertError) results.alerts++;
        }
      }
    }, { maxRetries: 1, timeoutMs: 15000 }).catch(e => results.errors.push(`USGS: ${(e as Error).message}`));

    // 6. NVD Vulnerabilities
    await resilientCall(`${FN}:nvd`, async () => {
      const nvdKey = Deno.env.get("NVD_API_KEY");
      const nvdUrl = nvdKey
        ? `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20&cvssV3Severity=CRITICAL`
        : `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=10`;
      const resp = await fetch(nvdUrl, { headers: nvdKey ? { "apiKey": nvdKey } : {} });
      if (!resp.ok) throw new Error(`NVD: ${resp.status}`);
      const data = await resp.json();

      for (const vuln of (data.vulnerabilities || []).slice(0, 10)) {
        const cve = vuln.cve;
        const cvss = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore || 7;
        const { error } = await supabase.from("security_incidents").insert({
          event_type: "vulnerability", severity: cvss, title: cve.id,
          summary: cve.descriptions?.[0]?.value?.slice(0, 500) || "Critical vulnerability",
          source: "NVD", raw: { cve_id: cve.id, cvss_score: cvss, published: cve.published },
        });
        if (!error) results.security_incidents++;
      }
    }, { maxRetries: 1, timeoutMs: 20000 }).catch(e => results.errors.push(`NVD: ${(e as Error).message}`));

    // 7. AI Geopolitical
    await resilientCall(`${FN}:ai-diplo`, async () => {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("No LOVABLE_API_KEY");
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "system", content: "You are a geopolitical analyst. Provide 5 current real-world diplomatic developments. Return JSON array with: title, country, severity (info/warning/critical), description."
          }, {
            role: "user", content: `Current date: ${new Date().toISOString().split("T")[0]}. List 5 significant current geopolitical events.`
          }],
          response_format: { type: "json_object" },
        }),
      });
      if (!aiResponse.ok) throw new Error(`AI: ${aiResponse.status}`);
      const aiData = await aiResponse.json();
      const parsed = JSON.parse(aiData.choices[0]?.message?.content);
      const events = parsed.events || parsed.developments || [];

      for (const event of events) {
        const { error } = await supabase.from("intel_events").insert({
          division: "diplomacy", event_type: "geopolitical",
          severity: event.severity || "info", title: event.title,
          description: event.description,
          payload: { source: "AI_Analysis", country: event.country },
          source_system: "AICIS Intelligence",
        });
        if (!error) results.intel_events++;
      }
    }, { maxRetries: 1, timeoutMs: 25000 }).catch(e => results.errors.push(`AI Diplomacy: ${(e as Error).message}`));

    // Log
    const total = results.crises + results.alerts + results.intel_events + results.security_incidents + results.critical_alerts;
    await supabase.from("automation_logs").insert({
      job_name: FN, status: results.errors.length > 0 ? "partial" : "success",
      message: `Populated: ${total} records (${results.errors.length} source errors)`,
    });

    await supabase.from("data_source_log").insert({
      division: "system", source: "live_data_aggregator", status: "success",
      records_ingested: total, last_success: new Date().toISOString(),
    });

    structuredLog('info', FN, `Populated ${total} records`, { errors: results.errors.length }, start);
    return jsonResponse({ success: true, message: "Live data populated", results });
  } catch (e) {
    structuredLog('error', FN, (e as Error).message, undefined, start);
    await supabase.from("automation_logs").insert({ job_name: FN, status: "error", message: (e as Error).message });
    return errorResponse(e);
  }
});

function parseGDACSXML(xml: string): GDACSEvent[] {
  const events: GDACSEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const getTag = (tag: string) => { const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(item); return m ? m[1].trim() : ""; };
    const getAttr = (tag: string, attr: string) => { const m = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`).exec(item); return m ? m[1] : ""; };
    events.push({
      eventtype: getAttr("gdacs:eventtype", "value") || getTag("gdacs:eventtype"),
      eventname: getTag("title") || getTag("gdacs:eventname"),
      country: getTag("gdacs:country") || "Global",
      fromdate: getTag("gdacs:fromdate") || getTag("pubDate"),
      todate: getTag("gdacs:todate") || "",
      alertlevel: getAttr("gdacs:alertlevel", "value") || getTag("gdacs:alertlevel"),
      severity: { severity: 0, severityUnit: "" }, url: getTag("link"), description: getTag("description"),
    });
  }
  return events;
}

function parseWHORSS(xml: string): { title: string; description: string; link: string; pubDate: string }[] {
  const items: { title: string; description: string; link: string; pubDate: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const getTag = (tag: string) => { const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(item); return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : ""; };
    items.push({ title: getTag("title"), description: getTag("description").slice(0, 500), link: getTag("link"), pubDate: getTag("pubDate") });
  }
  return items;
}

function extractCountryFromPlace(place: string): string {
  const parts = place.split(",");
  return parts[parts.length - 1]?.trim() || "Unknown";
}
