import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch SLA definitions and pipeline health
    const [{ data: slas }, { data: pipelines }, { data: recentLogs }] = await Promise.all([
      supabase.from("sla_definitions").select("*"),
      supabase.from("pipeline_health").select("*"),
      supabase.from("automation_logs").select("job_name, status, executed_at")
        .order("executed_at", { ascending: false }).limit(500),
    ]);

    if (!slas || slas.length === 0) {
      return new Response(JSON.stringify({ breaches: [], checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    const breaches: any[] = [];

    for (const sla of slas) {
      const pipeline = pipelines?.find((p: any) => p.pipeline_name === sla.pipeline_name);
      const pipelineLogs = (recentLogs || []).filter((l: any) => l.job_name === sla.pipeline_name);

      // Check staleness
      if (pipeline?.last_success_at) {
        const lastSuccess = new Date(pipeline.last_success_at).getTime();
        const staleHours = (now - lastSuccess) / 3600000;
        if (staleHours > sla.max_stale_hours) {
          breaches.push({
            pipeline_name: sla.pipeline_name,
            breach_type: "staleness",
            threshold: `${sla.max_stale_hours}h`,
            actual: `${Math.round(staleHours)}h`,
            severity: staleHours > sla.max_stale_hours * 2 ? "critical" : "warning",
          });
        }
      }

      // Check consecutive failures
      if (pipeline?.consecutive_failures && pipeline.consecutive_failures >= sla.max_consecutive_failures) {
        breaches.push({
          pipeline_name: sla.pipeline_name,
          breach_type: "consecutive_failures",
          threshold: sla.max_consecutive_failures,
          actual: pipeline.consecutive_failures,
          severity: "critical",
        });
      }

      // Check uptime from recent logs
      const relevant = pipelineLogs.slice(0, 20);
      if (relevant.length >= 5) {
        const successes = relevant.filter((l: any) => l.status === "success").length;
        const uptime = (successes / relevant.length) * 100;
        if (uptime < sla.target_uptime_pct) {
          breaches.push({
            pipeline_name: sla.pipeline_name,
            breach_type: "uptime",
            threshold: `${sla.target_uptime_pct}%`,
            actual: `${Math.round(uptime)}%`,
            severity: uptime < sla.target_uptime_pct - 5 ? "critical" : "warning",
          });
        }
      }
    }

    // Log breaches as alerts with 6h deduplication cooldown
    const COOLDOWN_HOURS = 6;
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600000).toISOString();

    for (const breach of breaches.filter(b => b.severity === "critical")) {
      // Check for existing recent alert for same pipeline+type
      const { data: existing } = await supabase
        .from("critical_alerts")
        .select("id")
        .eq("event_type", "sla_breach")
        .gte("triggered_at", cooldownCutoff)
        .contains("meta", { pipeline_name: breach.pipeline_name, breach_type: breach.breach_type })
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("critical_alerts").insert({
          headline: `SLA Breach: ${breach.pipeline_name} — ${breach.breach_type} (${breach.actual} vs ${breach.threshold})`,
          level: "warning",
          severity: 7,
          event_type: "sla_breach",
          meta: breach,
        });
      }
    }

    // Auto-resolve: mark old sla_breach alerts when pipeline recovered
    const recoveredPipelines = (slas as any[])
      .map(s => s.pipeline_name)
      .filter(name => !breaches.some(b => b.pipeline_name === name));

    if (recoveredPipelines.length > 0) {
      for (const name of recoveredPipelines) {
        await supabase
          .from("critical_alerts")
          .update({ acknowledged: true, ack_by: "system-auto-resolved" })
          .eq("event_type", "sla_breach")
          .eq("acknowledged", false)
          .contains("meta", { pipeline_name: name });
      }
    }

    return new Response(JSON.stringify({
      breaches,
      checked: slas.length,
      recovered: recoveredPipelines.length,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
