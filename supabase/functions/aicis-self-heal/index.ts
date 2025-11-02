import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // Get last diagnostic check
    const { data: lastCheck } = await supabase
      .from("diagnostics_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastCheck || lastCheck.status === 'healthy') {
      return new Response(JSON.stringify({ 
        ok: true, 
        message: "System stable - no healing required" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const actions: string[] = [];
    const repairs: any[] = [];

    // 1. Check for unresolved errors
    const { data: errors } = await supabase
      .from("system_errors")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (errors && errors.length > 0) {
      actions.push(`Found ${errors.length} unresolved errors`);
      
      // Mark old errors as resolved (older than 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await supabase
        .from("system_errors")
        .update({ resolved: true })
        .lt("created_at", oneDayAgo)
        .eq("resolved", false);
      
      if (!updateError) {
        actions.push("Auto-resolved errors older than 24h");
      }
    }

    // 2. Retry failed APIs
    if (lastCheck.failed_apis && Array.isArray(lastCheck.failed_apis) && lastCheck.failed_apis.length > 0) {
      for (const api of lastCheck.failed_apis) {
        actions.push(`Logging retry needed for ${api.name}`);
        repairs.push({
          component: api.name,
          action: 'retry_scheduled',
          status: 'pending'
        });
      }
    }

    // 3. Check failed tables
    if (lastCheck.failed_tables && Array.isArray(lastCheck.failed_tables) && lastCheck.failed_tables.length > 0) {
      for (const tbl of lastCheck.failed_tables) {
        // Try to access table again
        const { error } = await supabase.from(tbl).select("id").limit(1);
        
        if (!error) {
          actions.push(`Table ${tbl} now accessible`);
          repairs.push({
            component: tbl,
            action: 'table_recovered',
            status: 'success'
          });
        } else {
          actions.push(`Table ${tbl} still inaccessible`);
          repairs.push({
            component: tbl,
            action: 'table_check_failed',
            status: 'failed'
          });
        }
      }
    }

    // Log healing actions
    await supabase.from("system_errors").insert({
      component: "self-heal",
      message: "Auto repair cycle completed",
      details: { actions, repairs, timestamp: new Date().toISOString() },
      severity: 'low',
      resolved: true
    });

    console.log('Self-heal completed:', { actions, repairs });

    return new Response(JSON.stringify({ 
      ok: true, 
      healed: actions.length > 0,
      actions,
      repairs 
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Error in aicis-self-heal:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
