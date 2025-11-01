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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get recent unscored incidents (last 24 hours)
    const { data: incidents, error: fetchError } = await supabase
      .from('security_incidents')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .is('severity', null)
      .limit(500);

    if (fetchError) throw fetchError;

    let scored = 0;
    let alerted = 0;

    for (const incident of incidents || []) {
      // Calculate severity (0-100)
      let severity = 0;
      
      // Fatalities
      if (incident.killed) {
        severity += Math.min(incident.killed * 5, 50);
      }
      
      // Injuries
      if (incident.injured) {
        severity += Math.min(incident.injured * 2, 30);
      }
      
      // Displaced
      if (incident.displaced) {
        severity += Math.min(incident.displaced * 0.1, 20);
      }
      
      // Event type weighting
      const title = (incident.title || '').toLowerCase();
      if (title.includes('nuclear') || title.includes('chemical')) severity += 30;
      else if (title.includes('bombing') || title.includes('explosion')) severity += 20;
      else if (title.includes('attack') || title.includes('shooting')) severity += 15;
      else if (title.includes('kill')) severity += 10;
      
      severity = Math.min(severity, 100);
      
      // Update incident with severity
      await supabase
        .from('security_incidents')
        .update({ severity })
        .eq('id', incident.id);
      
      scored++;
      
      // Determine alert level and create alert
      let level: string | null = null;
      if (severity >= 80) level = 'urgent';
      else if (severity >= 60) level = 'high';
      else if (severity >= 40) level = 'medium';
      else if (severity >= 20) level = 'low';
      
      if (level) {
        const { error: alertError } = await supabase
          .from('critical_alerts')
          .insert({
            level,
            headline: incident.title,
            incident_id: incident.id,
            iso3: incident.iso3,
            country: incident.country,
            event_type: incident.event_type,
            severity,
            meta: {
              source: incident.source,
              killed: incident.killed,
              injured: incident.injured,
              displaced: incident.displaced
            }
          });
        
        if (!alertError) alerted++;
      }
    }

    console.log(`Scored ${scored} incidents, created ${alerted} alerts`);

    return new Response(JSON.stringify({ 
      ok: true,
      scored,
      alerted
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in score-security-incidents:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
