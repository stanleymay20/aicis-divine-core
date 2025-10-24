import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log("Starting daily report generation...");

    // Invoke report generation
    const { data, error } = await supabase.functions.invoke('generate-division-report');
    
    if (error) throw error;

    // Get all admin users to notify
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminRoles) {
      for (const admin of adminRoles) {
        await supabase.from('notifications').insert({
          type: 'report',
          title: 'Daily Global Division Report Available',
          message: 'Your daily AICIS performance report has been generated',
          division: 'system',
          user_id: admin.user_id
        });
      }
    }

    // Log cron execution
    await supabase.from('automation_logs').insert({
      job_name: 'cron-generate-daily-report',
      status: 'success',
      message: 'Daily report generated and admins notified'
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Daily report generation completed",
        data
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("cron-generate-daily-report error:", e);
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    await supabase.from('automation_logs').insert({
      job_name: 'cron-generate-daily-report',
      status: 'failure',
      message: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
    });

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
