import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  geo_lat?: number;
  geo_lon?: number;
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const results = {
    crises: 0,
    alerts: 0,
    intel_events: 0,
    security_incidents: 0,
    critical_alerts: 0,
    errors: [] as string[],
  };

  try {
    console.log("Starting live data population...");

    // 1. Fetch NASA EONET Events (Natural disasters, wildfires, etc.)
    try {
      const eonetResponse = await fetch(
        "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50"
      );
      if (eonetResponse.ok) {
        const eonetData = await eonetResponse.json();
        const events: EONETEvent[] = eonetData.events || [];

        for (const event of events) {
          const coords = event.geometry[0]?.coordinates;
          const severity = event.categories[0]?.id === "wildfires" ? 8 : 
                          event.categories[0]?.id === "severeStorms" ? 7 : 5;

          // Insert as crisis event
          const { error: crisisError } = await supabase.from("crisis_events").upsert({
            id: `eonet-${event.id}`,
            kind: event.categories[0]?.title || "Natural Event",
            region: event.title.split(" - ")[0] || "Global",
            severity,
            status: "monitoring",
            details_md: `## ${event.title}\n\n${event.description || "Active natural event detected by NASA EONET."}\n\n**Source:** [NASA EONET](${event.sources[0]?.url || "https://eonet.gsfc.nasa.gov"})`,
            opened_at: event.geometry[0]?.date || new Date().toISOString(),
          }, { onConflict: "id" });

          if (!crisisError) results.crises++;

          // Insert as intel event
          const { error: intelError } = await supabase.from("intel_events").insert({
            division: "crisis",
            event_type: "natural_disaster",
            severity: severity >= 7 ? "critical" : "warning",
            title: event.title,
            description: event.description || `${event.categories[0]?.title} event detected`,
            payload: { 
              source: "NASA_EONET", 
              event_id: event.id,
              coordinates: coords,
              category: event.categories[0]?.title
            },
            source_system: "NASA EONET",
          }).select().maybeSingle();

          if (!intelError) results.intel_events++;
        }
      }
    } catch (e) {
      results.errors.push(`EONET: ${(e as Error).message}`);
    }

    // 2. Fetch GDACS Events (Global Disaster Alert and Coordination System)
    try {
      const gdacsResponse = await fetch(
        "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?limit=30&orderby=severity:desc"
      );
      if (gdacsResponse.ok) {
        const gdacsText = await gdacsResponse.text();
        // GDACS returns XML, parse it
        const events = parseGDACSXML(gdacsText);
        
        for (const event of events) {
          const severityMap: Record<string, number> = { "Red": 9, "Orange": 7, "Green": 4 };
          const severity = severityMap[event.alertlevel] || 5;

          const { error } = await supabase.from("critical_alerts").upsert({
            id: `gdacs-${event.eventtype}-${event.fromdate}`,
            headline: event.eventname,
            level: event.alertlevel?.toLowerCase() || "warning",
            severity,
            country: event.country,
            event_type: event.eventtype,
            meta: { source: "GDACS", url: event.url },
            triggered_at: event.fromdate,
          }, { onConflict: "id" });

          if (!error) results.critical_alerts++;
        }
      }
    } catch (e) {
      results.errors.push(`GDACS: ${(e as Error).message}`);
    }

    // 3. Fetch ReliefWeb Disasters
    try {
      const reliefResponse = await fetch(
        "https://api.reliefweb.int/v1/disasters?appname=aicis&limit=30&preset=latest&fields[include][]=name&fields[include][]=status&fields[include][]=date&fields[include][]=country&fields[include][]=type&fields[include][]=primary_type&fields[include][]=description"
      );
      if (reliefResponse.ok) {
        const reliefData = await reliefResponse.json();
        const disasters: ReliefWebDisaster[] = reliefData.data || [];

        for (const disaster of disasters) {
          const country = disaster.fields.country?.[0]?.name || "Global";
          const iso3 = disaster.fields.country?.[0]?.iso3;
          const type = disaster.fields.primary_type?.name || disaster.fields.type?.[0]?.name || "Disaster";

          // Insert as alert
          const { error: alertError } = await supabase.from("alerts").insert({
            title: disaster.fields.name,
            message: `${type} affecting ${country}. Status: ${disaster.fields.status}`,
            severity: disaster.fields.status === "ongoing" ? "critical" : "high",
            division: "crisis",
            country,
            metadata: { 
              source: "ReliefWeb", 
              disaster_id: disaster.id,
              iso3,
              type
            },
          });

          if (!alertError) results.alerts++;

          // Insert as security incident for tracking
          if (disaster.fields.status === "ongoing") {
            const { error: secError } = await supabase.from("security_incidents").insert({
              event_type: "humanitarian_crisis",
              severity: 7,
              title: disaster.fields.name,
              summary: `${type} affecting ${country}`,
              country,
              iso3,
              source: "ReliefWeb",
              start_time: disaster.fields.date?.original || new Date().toISOString(),
              raw: { disaster_id: disaster.id, type },
            });

            if (!secError) results.security_incidents++;
          }
        }
      }
    } catch (e) {
      results.errors.push(`ReliefWeb: ${(e as Error).message}`);
    }

    // 4. Fetch WHO Disease Outbreaks
    try {
      const whoResponse = await fetch(
        "https://www.who.int/feeds/entity/csr/don/en/rss.xml"
      );
      if (whoResponse.ok) {
        const whoText = await whoResponse.text();
        const outbreaks = parseWHORSS(whoText);

        for (const outbreak of outbreaks.slice(0, 20)) {
          const { error } = await supabase.from("intel_events").insert({
            division: "health",
            event_type: "disease_outbreak",
            severity: outbreak.title.toLowerCase().includes("ebola") || 
                      outbreak.title.toLowerCase().includes("cholera") ? "critical" : "warning",
            title: outbreak.title,
            description: outbreak.description,
            payload: { source: "WHO", link: outbreak.link, pubDate: outbreak.pubDate },
            source_system: "WHO DON",
          });

          if (!error) results.intel_events++;
        }
      }
    } catch (e) {
      results.errors.push(`WHO: ${(e as Error).message}`);
    }

    // 5. Fetch USGS Earthquake Data
    try {
      const usgsResponse = await fetch(
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson"
      );
      if (usgsResponse.ok) {
        const usgsData = await usgsResponse.json();
        const quakes = usgsData.features || [];

        for (const quake of quakes) {
          const mag = quake.properties.mag;
          const place = quake.properties.place;
          const coords = quake.geometry.coordinates;

          const { error: crisisError } = await supabase.from("crisis_events").upsert({
            id: `usgs-${quake.id}`,
            kind: "Earthquake",
            region: place,
            severity: Math.min(Math.round(mag), 10),
            status: "monitoring",
            details_md: `## Magnitude ${mag} Earthquake\n\n**Location:** ${place}\n**Depth:** ${coords[2]} km\n**Time:** ${new Date(quake.properties.time).toISOString()}\n\n[USGS Details](${quake.properties.url})`,
            opened_at: new Date(quake.properties.time).toISOString(),
          }, { onConflict: "id" });

          if (!crisisError) results.crises++;

          // Create alert for significant quakes
          if (mag >= 5.5) {
            const { error: alertError } = await supabase.from("alerts").insert({
              title: `M${mag} Earthquake: ${place}`,
              message: `Significant seismic activity detected. Magnitude ${mag} at depth ${coords[2]}km.`,
              severity: mag >= 7 ? "critical" : "high",
              division: "crisis",
              country: extractCountryFromPlace(place),
              metadata: { source: "USGS", quake_id: quake.id, magnitude: mag, depth: coords[2] },
            });

            if (!alertError) results.alerts++;
          }
        }
      }
    } catch (e) {
      results.errors.push(`USGS: ${(e as Error).message}`);
    }

    // 6. Generate security incidents from NVD (National Vulnerability Database)
    try {
      const nvdKey = Deno.env.get("NVD_API_KEY");
      const nvdUrl = nvdKey 
        ? `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20&cvssV3Severity=CRITICAL`
        : `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=10`;
      
      const nvdResponse = await fetch(nvdUrl, {
        headers: nvdKey ? { "apiKey": nvdKey } : {},
      });

      if (nvdResponse.ok) {
        const nvdData = await nvdResponse.json();
        const vulnerabilities = nvdData.vulnerabilities || [];

        for (const vuln of vulnerabilities.slice(0, 10)) {
          const cve = vuln.cve;
          const cvss = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 
                       cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore || 7;

          const { error } = await supabase.from("security_incidents").insert({
            event_type: "vulnerability",
            severity: cvss,
            title: cve.id,
            summary: cve.descriptions?.[0]?.value?.slice(0, 500) || "Critical vulnerability detected",
            source: "NVD",
            raw: { 
              cve_id: cve.id, 
              cvss_score: cvss,
              published: cve.published,
              references: cve.references?.slice(0, 3)
            },
          });

          if (!error) results.security_incidents++;
        }
      }
    } catch (e) {
      results.errors.push(`NVD: ${(e as Error).message}`);
    }

    // 7. Generate diplomatic/governance alerts using AI
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "system",
              content: "You are a geopolitical analyst. Provide 5 current real-world diplomatic or governance developments. Return JSON array with: title, country, severity (info/warning/critical), description. Be factual, cite recent real events."
            }, {
              role: "user",
              content: `Current date: ${new Date().toISOString().split("T")[0]}. List 5 significant current geopolitical/diplomatic events happening now.`
            }],
            response_format: { type: "json_object" },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices[0]?.message?.content;
          const parsed = JSON.parse(content);
          const events = parsed.events || parsed.developments || [];

          for (const event of events) {
            const { error } = await supabase.from("intel_events").insert({
              division: "diplomacy",
              event_type: "geopolitical",
              severity: event.severity || "info",
              title: event.title,
              description: event.description,
              payload: { source: "AI_Analysis", country: event.country },
              source_system: "AICIS Intelligence",
            });

            if (!error) results.intel_events++;
          }
        }
      }
    } catch (e) {
      results.errors.push(`AI Diplomacy: ${(e as Error).message}`);
    }

    // Log the data population
    await supabase.from("automation_logs").insert({
      job_name: "seed-live-data",
      status: results.errors.length > 0 ? "partial" : "success",
      message: `Populated: ${results.crises} crises, ${results.alerts} alerts, ${results.intel_events} intel events, ${results.security_incidents} security incidents, ${results.critical_alerts} critical alerts`,
    });

    await supabase.from("data_source_log").insert({
      division: "system",
      source: "live_data_aggregator",
      status: "success",
      records_ingested: results.crises + results.alerts + results.intel_events + results.security_incidents + results.critical_alerts,
      last_success: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Live data populated successfully",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Error in seed-live-data:", e);
    
    await supabase.from("automation_logs").insert({
      job_name: "seed-live-data",
      status: "error",
      message: (e as Error).message,
    });

    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to parse GDACS XML
function parseGDACSXML(xml: string): GDACSEvent[] {
  const events: GDACSEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const getTag = (tag: string) => {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
      const m = regex.exec(item);
      return m ? m[1].trim() : "";
    };
    const getAttr = (tag: string, attr: string) => {
      const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`);
      const m = regex.exec(item);
      return m ? m[1] : "";
    };

    events.push({
      eventtype: getAttr("gdacs:eventtype", "value") || getTag("gdacs:eventtype"),
      eventname: getTag("title") || getTag("gdacs:eventname"),
      country: getTag("gdacs:country") || "Global",
      fromdate: getTag("gdacs:fromdate") || getTag("pubDate"),
      todate: getTag("gdacs:todate") || "",
      alertlevel: getAttr("gdacs:alertlevel", "value") || getTag("gdacs:alertlevel"),
      severity: { severity: 0, severityUnit: "" },
      url: getTag("link"),
      description: getTag("description"),
    });
  }

  return events;
}

// Helper function to parse WHO RSS
function parseWHORSS(xml: string): { title: string; description: string; link: string; pubDate: string }[] {
  const items: { title: string; description: string; link: string; pubDate: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const getTag = (tag: string) => {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
      const m = regex.exec(item);
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
    };

    items.push({
      title: getTag("title"),
      description: getTag("description").slice(0, 500),
      link: getTag("link"),
      pubDate: getTag("pubDate"),
    });
  }

  return items;
}

// Helper to extract country from USGS place string
function extractCountryFromPlace(place: string): string {
  const parts = place.split(",");
  return parts[parts.length - 1]?.trim() || "Unknown";
}
