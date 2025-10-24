import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running daily trust metrics computation...');

    // Invoke the main compute function
    const { data, error } = await supabaseClient.functions.invoke('compute-trust-metrics');

    if (error) throw error;

    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-compute-trust-metrics',
      status: 'success',
      message: `Trust metrics updated: ${JSON.stringify(data.metrics)}`,
      executed_at: new Date().toISOString()
    });

    console.log('Trust metrics computation complete');

    return new Response(JSON.stringify({ 
      success: true,
      metrics: data.metrics
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in cron-compute-trust-metrics:', error);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-compute-trust-metrics',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      executed_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
