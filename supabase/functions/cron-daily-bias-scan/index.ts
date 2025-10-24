import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running daily bias scan...');

    // Invoke the bias analysis function
    const { data, error } = await supabaseClient.functions.invoke('analyze-bias-trend', {
      body: {}
    });

    if (error) throw error;

    const avgBias = data.trends?.overall?.avg_bias || 0;
    const highBiasCount = data.trends?.overall?.high_bias_count || 0;

    // Log the automation
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-daily-bias-scan',
      status: 'success',
      message: `Bias scan complete. Avg bias: ${avgBias.toFixed(2)}%, High bias events: ${highBiasCount}`,
      executed_at: new Date().toISOString()
    });

    // Create notifications for high bias divisions
    if (highBiasCount > 0) {
      const { data: admins } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (admins) {
        for (const admin of admins) {
          await supabaseClient.from('notifications').insert({
            user_id: admin.user_id,
            type: 'warning',
            title: 'High Bias Detected',
            message: `${highBiasCount} AI decisions flagged for high bias. Average bias: ${avgBias.toFixed(2)}%`,
            division: 'ethics',
            link: '/ethics'
          });
        }
      }
    }

    console.log('Daily bias scan completed');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Bias scan completed',
      data
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in cron-daily-bias-scan:', error);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await supabaseClient.from('automation_logs').insert({
      job_name: 'cron-daily-bias-scan',
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