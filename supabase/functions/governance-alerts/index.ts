import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const alerts: Array<{ title: string; message: string; severity: string; division: string }> = [];

    // 1. Overdue reviews
    const { data: overdue } = await supabase
      .from("decision_outcome_log")
      .select("id, signal_title, review_due_at, domain")
      .or("review_status.is.null,review_status.eq.pending")
      .lt("review_due_at", now.toISOString())
      .not("review_due_at", "is", null);

    if (overdue && overdue.length > 0) {
      alerts.push({
        title: `${overdue.length} overdue decision review(s)`,
        message: `Decisions requiring review have exceeded their SLA deadline. Oldest: "${overdue[0].signal_title || "Untitled"}"`,
        severity: "high",
        division: "governance",
      });
    }

    // 2. Failed accepted recommendations without postmortem after 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const { data: missingPM } = await supabase
      .from("decision_outcome_log")
      .select("id, signal_title")
      .eq("recommendation_accepted", true)
      .eq("outcome_success", false)
      .is("postmortem_note", null)
      .lt("outcome_timestamp", sevenDaysAgo);

    if (missingPM && missingPM.length > 0) {
      alerts.push({
        title: `${missingPM.length} failed decision(s) missing postmortem`,
        message: `Accepted recommendations that failed have no postmortem note after 7+ days. This is a governance gap.`,
        severity: "high",
        division: "governance",
      });
    }

    // 3. Overridden decisions with no reviewer note
    const { data: noNote } = await supabase
      .from("decision_outcome_log")
      .select("id, signal_title")
      .eq("review_status", "overridden")
      .is("override_reason", null);

    if (noNote && noNote.length > 0) {
      alerts.push({
        title: `${noNote.length} overridden decision(s) without reason`,
        message: `Decisions were overridden but no override reason was recorded. This violates governance policy.`,
        severity: "critical",
        division: "governance",
      });
    }

    // 4. Critical decisions pending dual approval
    const { data: dualPending } = await supabase
      .from("decision_outcome_log")
      .select("id, signal_title")
      .eq("requires_dual_approval", true)
      .or("second_review_status.is.null,second_review_status.eq.pending")
      .or("review_status.is.null,review_status.eq.pending,review_status.eq.approved");

    if (dualPending && dualPending.length > 0) {
      alerts.push({
        title: `${dualPending.length} critical decision(s) awaiting dual approval`,
        message: `High-criticality decisions require a second reviewer but dual approval is not yet complete.`,
        severity: "high",
        division: "governance",
      });
    }

    // --- SILENT FAILURE ALERTS ---

    // 5. No measured outcomes in last 14 days
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
    const { count: recentMeasured } = await supabase
      .from("decision_outcome_log")
      .select("id", { count: "exact", head: true })
      .eq("evidence_type", "measured")
      .gte("outcome_timestamp", fourteenDaysAgo);

    if ((recentMeasured ?? 0) === 0) {
      alerts.push({
        title: "No measured outcomes recorded in 14 days",
        message: "The decision engine has not received any real-world measured outcomes recently. This stalls the learning loop.",
        severity: "high",
        division: "decision-engine",
      });
    }

    // 6. No inference audit records in last 24h
    const oneDayAgo = new Date(now.getTime() - 24 * 3600000).toISOString();
    const { count: recentInference } = await supabase
      .from("decision_inference_audit")
      .select("id", { count: "exact", head: true })
      .gte("inferred_at", oneDayAgo);

    if ((recentInference ?? 0) === 0) {
      alerts.push({
        title: "No inference audit records in 24 hours",
        message: "The decision inference pipeline has not logged any audit records in the last 24 hours.",
        severity: "medium",
        division: "decision-engine",
      });
    }

    // 7. Weekly learning cron failed (check last run)
    const { data: lastLearn } = await supabase
      .from("system_logs")
      .select("log_level, created_at")
      .eq("action", "weekly_decision_learning")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastLearn && lastLearn.log_level === "error") {
      alerts.push({
        title: "Weekly learning cycle failed",
        message: "The most recent weekly decision learning run encountered an error. Model calibration may be stale.",
        severity: "high",
        division: "decision-engine",
      });
    }

    // 8. Active model older than 30 days without re-evaluation
    const { data: activeModel } = await supabase
      .from("decision_models")
      .select("version, last_calibrated_at")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (activeModel?.last_calibrated_at) {
      const calAge = (now.getTime() - new Date(activeModel.last_calibrated_at).getTime()) / 86400000;
      if (calAge > 30) {
        alerts.push({
          title: "Active model calibration is stale",
          message: `Model ${activeModel.version} was last calibrated ${Math.round(calAge)} days ago. Re-evaluation recommended.`,
          severity: "medium",
          division: "decision-engine",
        });
      }
    }

    // 9. Trust score drop detection
    const { data: recentEvals } = await supabase
      .from("model_evaluations")
      .select("acceptance_rate, calibration_error, evaluated_at")
      .order("evaluated_at", { ascending: false })
      .limit(2);

    if (recentEvals && recentEvals.length >= 2) {
      const computeTrust = (e: any) => {
        const ece = e.calibration_error ?? 0.5;
        const accept = e.acceptance_rate ?? 0;
        return (1 - Math.min(ece, 1)) * 40 + accept * 30;
      };
      const current = computeTrust(recentEvals[0]);
      const previous = computeTrust(recentEvals[1]);
      if (previous - current > 10) {
        alerts.push({
          title: "Trust score dropped significantly",
          message: `Trust score component dropped by ${Math.round(previous - current)} points between evaluations.`,
          severity: "high",
          division: "decision-engine",
        });
      }
    }

    // Write alerts (deduplicate by title within 6h)
    let inserted = 0;
    for (const alert of alerts) {
      const sixHoursAgo = new Date(now.getTime() - 6 * 3600000).toISOString();
      const { data: existing } = await supabase
        .from("alerts")
        .select("id")
        .eq("title", alert.title)
        .eq("division", alert.division)
        .gte("created_at", sixHoursAgo)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("alerts").insert(alert);
        inserted++;
      }
    }

    // Also log to system_logs for audit
    await supabase.from("system_logs").insert({
      action: "governance_alerts_scan",
      result: JSON.stringify({
        alerts_detected: alerts.length,
        alerts_inserted: inserted,
        categories: alerts.map(a => a.title),
      }),
      log_level: "info",
      division: "governance",
    });

    return new Response(JSON.stringify({
      ok: true,
      alerts_detected: alerts.length,
      alerts_inserted: inserted,
      overdue_count: overdue?.length || 0,
      missing_postmortem_count: missingPM?.length || 0,
      unresolved_overrides: noNote?.length || 0,
      no_measured_14d: (recentMeasured ?? 0) === 0,
      no_inference_24h: (recentInference ?? 0) === 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Governance alerts error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
