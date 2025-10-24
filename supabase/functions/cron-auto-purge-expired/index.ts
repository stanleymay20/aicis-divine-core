import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running auto-purge of expired records...');

    // Invoke the purge function
    const { data, error } = await supabaseClient.functions.invoke('auto-purge-expired-records', {
      body: {}
    });

    if (error) throw error;

    // Log the automation
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-auto-purge-expired',
      status: 'success',
      message: `Purged expired records: ${data.results?.length || 0} categories processed`,
      executed_at: new Date().toISOString()
    });

    console.log('Auto-purge completed');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Auto-purge completed',
      data
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in cron-auto-purge-expired:', error);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-auto-purge-expired',
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