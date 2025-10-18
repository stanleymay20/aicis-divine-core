import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { division, event_type, severity, title, description, payload, source_system } = await req.json();

    console.log('Publishing intel event:', { division, event_type, severity, title });

    // Compliance check
    await supabaseClient.from('compliance_audit').insert({
      action_type: 'intel_event_publish',
      division,
      user_id: user.id,
      action_description: `Published ${severity} intel event: ${title}`,
      compliance_status: 'compliant',
      data_accessed: { event_type, severity }
    });

    // Publish event to intel_events (realtime enabled)
    const { data: event, error: insertError } = await supabaseClient
      .from('intel_events')
      .insert({
        division,
        event_type,
        severity,
        title,
        description,
        payload,
        source_system,
        published_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Log to system_logs
    await supabaseClient.from('system_logs').insert({
      action: 'intel_event_published',
      division,
      user_id: user.id,
      log_level: severity === 'emergency' ? 'error' : severity === 'critical' ? 'warning' : 'info',
      result: `Published: ${title}`,
      metadata: { event_id: event.id, event_type, severity }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Intel event published to ${division} division`,
        event,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Publish intel event error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});