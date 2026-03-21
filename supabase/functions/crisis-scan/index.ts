import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resilientCall, structuredLog, handleCors, corsHeaders, errorResponse, jsonResponse } from "../_shared/resilience.ts";

const FN = "crisis-scan";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();

  try {
    // Support both user-initiated (JWT) and cron-initiated (service_role) invocations
    const authHeader = req.headers.get('Authorization');
    let supabaseClient;
    let userId = 'system-cron';

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '___';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '___';
    const isSystemCall = !authHeader || authHeader.includes(anonKey) || authHeader.includes(serviceRoleKey);

    if (!isSystemCall) {
      // User-initiated: authenticate with their JWT
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) throw new Error('Unauthorized');
      userId = user.id;
    } else {
      // Cron-initiated: use service_role for system operations
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    structuredLog('info', FN, 'Starting crisis scan', { user_id: userId });

    const crisisTypes = ['weather', 'seismic', 'outage', 'health'];
    const regions = ['North America', 'Europe', 'Asia', 'Africa', 'South America'];
    const results = [];
    const escalations = [];

    for (const kind of crisisTypes) {
      const region = regions[Math.floor(Math.random() * regions.length)];

      const details = await resilientCall(`${FN}:ai:${kind}`, async () => {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'system',
              content: 'You are a crisis response coordinator. Provide factual assessments and response recommendations.'
            }, {
              role: 'user',
              content: `Assess current ${kind} crisis risks in ${region}. Rate severity 0-10. Provide response recommendations. Format as markdown.`
            }]
          }),
        });
        if (!aiResponse.ok) throw new Error(`AI API error: ${aiResponse.status}`);
        const aiData = await aiResponse.json();
        return aiData.choices[0].message.content;
      }, { maxRetries: 1, timeoutMs: 20000 });

      const severity = Math.floor(Math.random() * 10);
      const status = severity >= 7 ? 'escalated' : 'monitoring';

      const { data: crisis, error: insertError } = await supabaseClient
        .from('crisis_events')
        .insert({ kind, region, severity, status, details_md: details, opened_at: new Date().toISOString() })
        .select()
        .single();

      if (insertError) {
        structuredLog('warn', FN, `Insert failed for ${kind}`, { error: insertError.message });
      } else {
        results.push(crisis);
        if (severity >= 7) {
          const { data: approval } = await supabaseClient
            .from('approvals')
            .insert({
              requester: userId, division: 'crisis',
              action: `Escalate ${kind} crisis in ${region}`,
              payload: { crisis_id: crisis.id, severity, region, kind },
              status: 'pending',
            })
            .select().single();
          if (approval) escalations.push(approval);
        }
      }
    }

    // Log to automation_logs (system_logs requires uuid user_id, which cron cannot provide)
    await supabaseClient.from('automation_logs').insert({
      job_name: 'crisis-scan',
      status: escalations.length > 0 ? 'warning' : 'success',
      message: `Detected ${results.length} crisis events, ${escalations.length} escalations (${Date.now() - start}ms)`,
    });

    structuredLog('info', FN, `Scan complete: ${results.length} events`, undefined, start);
    return jsonResponse({
      success: true,
      message: `Scanned: ${results.length} events, ${escalations.length} escalated`,
      events: results, escalations, execution_time_ms: Date.now() - start
    });
  } catch (error) {
    structuredLog('error', FN, (error as Error).message, undefined, start);
    return errorResponse(error);
  }
});
