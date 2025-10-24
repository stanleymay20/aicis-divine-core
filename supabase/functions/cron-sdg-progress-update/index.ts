import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running SDG progress update...');

    // Invoke the SDG evaluation function
    const { data, error } = await supabaseClient.functions.invoke('sdg-evaluate-progress', {
      body: {}
    });

    if (error) throw error;

    // Log the automation
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-sdg-progress-update',
      status: 'success',
      message: `Updated SDG progress for all 17 goals`,
      executed_at: new Date().toISOString()
    });

    console.log('SDG progress update completed');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'SDG progress updated',
      data
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in cron-sdg-progress-update:', error);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-sdg-progress-update',
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