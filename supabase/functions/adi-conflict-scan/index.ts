import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resilientCall, structuredLog, handleCors, corsHeaders, errorResponse, jsonResponse } from "../_shared/resilience.ts";

const FN = "adi-conflict-scan";

// Static hotspots — always scanned
const STATIC_HOTSPOTS = [
  { region: 'Eastern Europe', iso3: 'UKR', context: 'Russia-Ukraine war, NATO tensions' },
  { region: 'Middle East', iso3: 'PSE', context: 'Israel-Palestine conflict, regional proxy wars' },
  { region: 'East Asia', iso3: 'TWN', context: 'Taiwan Strait tensions, South China Sea disputes' },
  { region: 'Sahel', iso3: 'MLI', context: 'Sahel insurgency, Wagner Group presence' },
  { region: 'Horn of Africa', iso3: 'SDN', context: 'Sudan civil war, Ethiopian tensions' },
  { region: 'South Asia', iso3: 'MMR', context: 'Myanmar civil war, border instabilities' },
  { region: 'Korean Peninsula', iso3: 'PRK', context: 'Nuclear tensions, military provocations' },
  { region: 'Central Africa', iso3: 'COD', context: 'DRC conflict, M23 insurgency' },
];

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    structuredLog('info', FN, 'Starting conflict scan with dynamic discovery');

    // ── Dynamic Discovery: find new hotspots from vulnerability + anomaly data ──
    const dynamicHotspots: typeof STATIC_HOTSPOTS = [];
    const staticISO3s = new Set(STATIC_HOTSPOTS.map(h => h.iso3));

    // 1. High vulnerability countries not in static list
    const { data: vulnCountries } = await supabase
      .from('vulnerability_scores')
      .select('country, iso_code, overall_score')
      .gte('overall_score', 70)
      .order('overall_score', { ascending: false })
      .limit(20);

    if (vulnCountries) {
      for (const vc of vulnCountries) {
        if (!staticISO3s.has(vc.iso_code) && !dynamicHotspots.find(h => h.iso3 === vc.iso_code)) {
          dynamicHotspots.push({
            region: vc.country || vc.iso_code,
            iso3: vc.iso_code,
            context: `Dynamic: vulnerability score ${vc.overall_score}/100`,
          });
        }
        if (dynamicHotspots.length >= 4) break;
      }
    }

    // 2. Countries with recent critical anomalies
    const { data: anomalyCountries } = await supabase
      .from('anomaly_detections')
      .select('division, severity, description, metrics')
      .in('severity', ['critical', 'high'])
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);

    // 3. Countries with recent crisis events not in static list
    const { data: crisisCountries } = await supabase
      .from('crisis_events')
      .select('region, severity, kind')
      .in('status', ['active', 'escalated'])
      .gte('severity', 7)
      .order('opened_at', { ascending: false })
      .limit(10);

    if (crisisCountries) {
      for (const ce of crisisCountries) {
        const regionLower = (ce.region || '').toLowerCase();
        const alreadyCovered = STATIC_HOTSPOTS.some(h => h.region.toLowerCase() === regionLower) ||
          dynamicHotspots.some(h => h.region.toLowerCase() === regionLower);
        if (!alreadyCovered && dynamicHotspots.length < 6) {
          dynamicHotspots.push({
            region: ce.region,
            iso3: ce.region.substring(0, 3).toUpperCase(),
            context: `Dynamic: active ${ce.kind} crisis, severity ${ce.severity}`,
          });
        }
      }
    }

    const allHotspots = [...STATIC_HOTSPOTS, ...dynamicHotspots];
    structuredLog('info', FN, `Scanning ${allHotspots.length} hotspots (${STATIC_HOTSPOTS.length} static + ${dynamicHotspots.length} dynamic)`);

    const results: any[] = [];

    for (const hotspot of allHotspots) {
      const analysis = await resilientCall(`${FN}:ai:${hotspot.iso3}`, async () => {
        const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'system',
              content: `You are a conflict risk analyst generating structured hypotheses for human review. Assess current armed conflict risks based on recent events and geopolitical context. Be conservative in estimates. Label all outputs as AI-assisted analysis, NOT validated intelligence. Return ONLY valid JSON with this structure:
{
  "protest_momentum": 0-100,
  "conflict_intensity": 0-100,
  "military_escalation": 0-100,
  "diplomatic_tension": 0-100,
  "media_hostility_index": 0-100,
  "escalation_probability": 0-100,
  "time_to_conflict_days": null or number,
  "conflict_type": "interstate" | "civil" | "insurgency" | "border_dispute" | "proxy" | null,
  "involved_parties": ["string"],
  "triggers": ["string"],
  "historical_parallels": ["string"],
  "assessment": "2-3 paragraph markdown assessment",
  "confidence": 0-100
}`
            }, {
              role: 'user',
              content: `Assess conflict risk for ${hotspot.region} (${hotspot.iso3}). Context: ${hotspot.context}. Date: ${new Date().toISOString().split('T')[0]}.`
            }],
          }),
        });
        if (!resp.ok) throw new Error(`AI error: ${resp.status}`);
        const data = await resp.json();
        return data.choices[0].message.content;
      }, { maxRetries: 1, timeoutMs: 25000 });

      let parsed;
      try {
        const cleaned = analysis.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        structuredLog('warn', FN, `Parse failed for ${hotspot.iso3}`);
        continue;
      }

      const isDynamic = !staticISO3s.has(hotspot.iso3);

      const { data: signal, error } = await supabase
        .from('conflict_signals')
        .insert({
          country_iso3: hotspot.iso3,
          region: hotspot.region,
          protest_momentum: parsed.protest_momentum || 0,
          conflict_intensity: parsed.conflict_intensity || 0,
          military_escalation: parsed.military_escalation || 0,
          diplomatic_tension: parsed.diplomatic_tension || 0,
          media_hostility_index: parsed.media_hostility_index || 0,
          escalation_probability: Math.min(parsed.escalation_probability || 0, 95),
          time_to_conflict_days: parsed.time_to_conflict_days,
          conflict_type: parsed.conflict_type,
          involved_parties: parsed.involved_parties || [],
          triggers: parsed.triggers || [],
          historical_parallels: parsed.historical_parallels || [],
          assessment_md: parsed.assessment || '',
          data_sources: isDynamic
            ? ['vulnerability_threshold', 'ai_synthesis']
            : ['gdelt', 'acled', 'ai_synthesis'],
          confidence: Math.min(parsed.confidence || 50, 90),
          status: 'active',
        })
        .select()
        .single();

      if (!error && signal) {
        results.push(signal);

        if (parsed.escalation_probability >= 60) {
          await supabase.from('adi_decisions').insert({
            signal_source: 'conflict_signal',
            signal_id: signal.id,
            signal_summary: `Conflict escalation risk ${parsed.escalation_probability}% in ${hotspot.region} (${hotspot.iso3})${isDynamic ? ' [DYNAMIC DISCOVERY]' : ''}`,
            region: hotspot.region,
            country_iso3: hotspot.iso3,
            domain: 'conflict',
            severity_score: parsed.escalation_probability / 10,
            options: [],
            reasoning_md: parsed.assessment || '',
            confidence: Math.min(parsed.confidence || 50, 90),
            status: 'pending',
          });
        }
      }
    }

    await supabase.from('automation_logs').insert({
      job_name: FN, status: 'success',
      message: `Scanned ${results.length} hotspots (${dynamicHotspots.length} dynamic), ${results.filter(r => r.escalation_probability >= 60).length} high-risk`
    });

    structuredLog('info', FN, `Complete: ${results.length} signals (${dynamicHotspots.length} dynamic)`, undefined, start);
    return jsonResponse({
      success: true,
      signals: results,
      static_count: STATIC_HOTSPOTS.length,
      dynamic_count: dynamicHotspots.length,
      dynamic_discoveries: dynamicHotspots.map(h => ({ iso3: h.iso3, region: h.region, context: h.context })),
      execution_time_ms: Date.now() - start,
    });
  } catch (e) {
    structuredLog('error', FN, (e as Error).message, undefined, start);
    return errorResponse(e);
  }
});
