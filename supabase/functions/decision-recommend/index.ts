import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { country_iso3, domain } = await req.json().catch(() => ({}));

    // 1. Pull latest performance snapshots (top risk countries or specific)
    let snapshotQuery = supabase
      .from("country_performance_snapshots")
      .select("iso3, domain, performance_index, momentum_score, risk_pressure_score, systemic_fragility_score, forecast_direction, confidence_score, structural_break_count")
      .order("risk_pressure_score", { ascending: false })
      .limit(50);

    if (country_iso3) snapshotQuery = snapshotQuery.eq("iso3", country_iso3);
    if (domain) snapshotQuery = snapshotQuery.eq("domain", domain);

    // 2. Pull active anomalies
    let anomalyQuery = supabase
      .from("anomaly_detections")
      .select("division, anomaly_type, severity, description, deviation_percentage, detected_at")
      .eq("status", "active")
      .order("detected_at", { ascending: false })
      .limit(20);

    // 3. Pull recent critical alerts
    let alertQuery = supabase
      .from("critical_alerts")
      .select("headline, level, country, severity, event_type, triggered_at")
      .eq("acknowledged", false)
      .order("triggered_at", { ascending: false })
      .limit(15);

    // 4. Pull active crisis events
    let crisisQuery = supabase
      .from("crisis_events")
      .select("region, kind, severity, status, details_md")
      .neq("status", "resolved")
      .order("severity", { ascending: false })
      .limit(10);

    // Execute all in parallel
    const [snapshots, anomalies, alerts, crises] = await Promise.all([
      snapshotQuery, anomalyQuery, alertQuery, crisisQuery
    ]);

    // Build context for AI
    const signalContext = {
      performance_snapshots: snapshots.data || [],
      active_anomalies: anomalies.data || [],
      unacknowledged_alerts: alerts.data || [],
      active_crises: crises.data || [],
      request_scope: { country_iso3: country_iso3 || "global", domain: domain || "all" },
    };

    const systemPrompt = `You are AICIS Decision Intelligence Engine — a sovereign-grade decision recommendation system for global risk management.

You analyze structured intelligence signals (performance indices, anomalies, alerts, crises) and produce actionable decision recommendations.

RULES:
- Every recommendation MUST be grounded in the provided signal data
- Cite specific metrics (e.g., "risk_pressure_score: 78.3 for NGA/security")
- Assign confidence based on signal density and consistency
- Prioritize by urgency and impact
- Be specific about WHAT action to take, WHO should act, and WHEN
- Never fabricate data — if signals are insufficient, say so
- Use "recommended_action" for the primary action and "alternatives" for backup options

OUTPUT FORMAT (strict JSON via tool call):
Return 3-5 decision recommendations ranked by priority.`;

    const userPrompt = `Analyze these live intelligence signals and generate decision recommendations:

${JSON.stringify(signalContext, null, 2)}

Focus on:
1. Highest-risk situations requiring immediate attention
2. Emerging patterns that suggest upcoming crises
3. Opportunities where intervention can prevent escalation
4. Resource allocation priorities`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_recommendations",
            description: "Submit structured decision recommendations based on intelligence signals.",
            parameters: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Short unique ID like REC-001" },
                      priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      title: { type: "string", description: "One-line recommendation title" },
                      domain: { type: "string", description: "Primary domain (security, health, finance, etc.)" },
                      affected_countries: { type: "array", items: { type: "string" }, description: "ISO3 codes" },
                      signal_summary: { type: "string", description: "Key signals driving this recommendation" },
                      recommended_action: { type: "string", description: "Specific action to take" },
                      alternatives: { type: "array", items: { type: "string" }, description: "Alternative actions" },
                      confidence: { type: "number", description: "0-100 confidence score" },
                      urgency: { type: "string", enum: ["immediate", "24h", "7d", "30d"] },
                      expected_impact: { type: "string", description: "What happens if action is taken" },
                      risk_if_ignored: { type: "string", description: "What happens if not acted upon" },
                    },
                    required: ["id", "priority", "title", "domain", "signal_summary", "recommended_action", "confidence", "urgency"],
                    additionalProperties: false,
                  },
                },
                global_assessment: { type: "string", description: "1-2 sentence overall risk posture assessment" },
                signal_quality: { type: "string", enum: ["strong", "moderate", "weak", "insufficient"] },
              },
              required: ["recommendations", "global_assessment", "signal_quality"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_recommendations" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured recommendations");
    }

    const recommendations = JSON.parse(toolCall.function.arguments);

    // Log to decision audit
    await supabase.from("ai_decision_logs").insert({
      division_key: domain || "system",
      model_name: "gemini-2.5-flash",
      input_summary: `Decision recommendation for ${country_iso3 || 'global'} / ${domain || 'all domains'}`,
      output_summary: recommendations.global_assessment,
      confidence: recommendations.recommendations?.[0]?.confidence || 0,
      explanation: { signal_counts: signalContext },
    });

    return new Response(JSON.stringify({
      ok: true,
      ...recommendations,
      generated_at: new Date().toISOString(),
      scope: { country_iso3: country_iso3 || "global", domain: domain || "all" },
      signal_counts: {
        snapshots: signalContext.performance_snapshots.length,
        anomalies: signalContext.active_anomalies.length,
        alerts: signalContext.unacknowledged_alerts.length,
        crises: signalContext.active_crises.length,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Decision recommend error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
