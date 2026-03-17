import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resilientCall, structuredLog, handleCors, corsHeaders, errorResponse, jsonResponse } from "../_shared/resilience.ts";

const FN = "adi-analyze";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate caller
    let userId = 'system';
    if (authHeader && !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '___')) {
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) userId = user.id;
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const body = await req.json().catch(() => ({}));
    const { mode = 'auto', signal_id, domain, region, custom_query } = body;

    structuredLog('info', FN, `ADI analysis: mode=${mode}`, { userId, domain, region });

    // Gather signals to analyze
    let signals: any[] = [];

    if (mode === 'manual' && custom_query) {
      // Manual query mode — user asks a specific question
      signals = [{ type: 'manual_query', summary: custom_query, severity: 5, domain: domain || 'general' }];
    } else if (signal_id) {
      // Analyze specific signal
      const { data: crisis } = await supabase.from('crisis_events').select('*').eq('id', signal_id).single();
      if (crisis) signals.push({ ...crisis, type: 'crisis_event' });
    } else {
      // Auto mode — scan recent high-severity signals
      const { data: crises } = await supabase
        .from('crisis_events')
        .select('*')
        .gte('severity', 6)
        .in('status', ['active', 'escalated', 'monitoring'])
        .order('opened_at', { ascending: false })
        .limit(5);

      const { data: conflicts } = await supabase
        .from('conflict_signals')
        .select('*')
        .eq('status', 'active')
        .gte('escalation_probability', 40)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: anomalies } = await supabase
        .from('anomaly_detections')
        .select('*')
        .in('severity', ['high', 'critical'])
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5);

      if (crises) signals.push(...crises.map(c => ({ ...c, type: 'crisis_event' })));
      if (conflicts) signals.push(...conflicts.map(c => ({ ...c, type: 'conflict_signal' })));
      if (anomalies) signals.push(...anomalies.map(a => ({ ...a, type: 'anomaly' })));
    }

    if (signals.length === 0) {
      return jsonResponse({ success: true, message: 'No high-severity signals to analyze', decisions: [] });
    }

    const decisions: any[] = [];

    for (const signal of signals.slice(0, 3)) {
      const signalSummary = signal.type === 'manual_query'
        ? signal.summary
        : `${signal.type}: ${signal.kind || signal.anomaly_type || signal.conflict_type || 'unknown'} in ${signal.region || 'unknown region'}, severity: ${signal.severity || signal.escalation_probability || 'N/A'}`;

      const aiResult = await resilientCall(`${FN}:ai`, async () => {
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
              content: `You are ADI (Artificial Decision Intelligence), AICIS's decision advisory co-pilot operating in SHADOW MODE.
You generate structured decision hypotheses for human analyst review. All outputs are AI-assisted analysis, NOT validated intelligence or operational directives. Be conservative and explicit about uncertainty.

For each signal, produce EXACTLY 3 decision options as a JSON array. Each option must have:
- rank (1-3, 1 = recommended)
- action (short title)
- description (2-3 sentences)
- effectiveness_pct (0-100 estimated effectiveness)
- risk_level ("low", "medium", "high")
- risk_assessment (key risks)
- tradeoffs (what you give up)
- timeframe ("immediate", "7_days", "30_days", "90_days")
- resources_required ("minimal", "moderate", "significant", "massive")

Also provide:
- reasoning: markdown explaining your analysis (2-3 paragraphs)
- confidence: 0-100
- domain: the primary domain

Return ONLY valid JSON: { "options": [...], "reasoning": "...", "confidence": N, "domain": "..." }`
            }, {
              role: 'user',
              content: `Analyze this signal and provide decision options:\n\n${signalSummary}`
            }],
          }),
        });
        if (!resp.ok) {
          if (resp.status === 429) throw new Error('Rate limited');
          if (resp.status === 402) throw new Error('Payment required');
          throw new Error(`AI error: ${resp.status}`);
        }
        const data = await resp.json();
        return data.choices[0].message.content;
      }, { maxRetries: 2, timeoutMs: 30000 });

      // Parse AI response
      let parsed;
      try {
        const cleaned = aiResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        structuredLog('warn', FN, 'Failed to parse AI response', { raw: aiResult?.slice(0, 200) });
        continue;
      }

      const { data: decision, error } = await supabase
        .from('adi_decisions')
        .insert({
          signal_source: signal.type,
          signal_id: signal.id || null,
          signal_summary: signalSummary,
          region: signal.region || null,
          country_iso3: signal.country_iso3 || null,
          domain: parsed.domain || signal.domain || 'general',
          severity_score: signal.severity || signal.escalation_probability || 5,
          options: parsed.options || [],
          recommended_option_rank: 1,
          reasoning_md: parsed.reasoning || '',
          confidence: Math.min(parsed.confidence || 60, 95),
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        structuredLog('warn', FN, `Insert failed: ${error.message}`);
      } else {
        decisions.push(decision);

        // Generate scenario simulations for the top decision
        if (parsed.options?.[0]) {
          const scenarios = ['best_case', 'worst_case', 'baseline'];
          for (const scenarioType of scenarios) {
            await supabase.from('adi_scenarios').insert({
              decision_id: decision.id,
              scenario_name: `${scenarioType.replace('_', ' ')} — ${parsed.options[0].action}`,
              scenario_type: scenarioType,
              input_params: { action: parsed.options[0].action, timeframe: parsed.options[0].timeframe },
              projection_30d: { stability_delta: scenarioType === 'best_case' ? 15 : scenarioType === 'worst_case' ? -20 : 0 },
              projection_60d: { stability_delta: scenarioType === 'best_case' ? 25 : scenarioType === 'worst_case' ? -35 : -5 },
              projection_90d: { stability_delta: scenarioType === 'best_case' ? 30 : scenarioType === 'worst_case' ? -45 : -10 },
              confidence: Math.min(parsed.confidence || 50, 85),
              reasoning_md: `${scenarioType.replace('_', ' ')} projection for: ${parsed.options[0].action}`,
              created_by: userId !== 'system' ? userId : null,
            });
          }
        }
      }
    }

    // Log
    await supabase.from('system_logs').insert({
      action: 'adi_analysis', division: 'adi', user_id: userId,
      log_level: 'info',
      result: `Generated ${decisions.length} decision analyses`,
      metadata: { decisions_count: decisions.length, mode, execution_time_ms: Date.now() - start }
    });

    structuredLog('info', FN, `Complete: ${decisions.length} decisions`, undefined, start);
    return jsonResponse({ success: true, decisions, execution_time_ms: Date.now() - start });
  } catch (e) {
    structuredLog('error', FN, (e as Error).message, undefined, start);
    return errorResponse(e);
  }
});
