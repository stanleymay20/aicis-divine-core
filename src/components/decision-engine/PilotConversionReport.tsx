import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileBarChart } from "lucide-react";

export default function PilotConversionReport() {
  const { data } = useQuery({
    queryKey: ["pilot-conversion-report"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [total, accepted, executed, completed, measured, measuredWeek, failed, postmortems, withROI, proxy, real, measuredTD, auditCount, silentFailures, domains] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("recommendation_accepted", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("action_taken", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("execution_status", "completed"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("evidence_type", "measured"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("evidence_type", "measured").gte("outcome_timestamp", weekAgo),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("outcome_success", false),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).not("postmortem_note", "is", null),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).not("roi_estimate", "is", null),
        supabase.from("decision_training_dataset").select("id", { count: "exact", head: true }).eq("source_type", "proxy"),
        supabase.from("decision_training_dataset").select("id", { count: "exact", head: true }).neq("source_type", "proxy"),
        supabase.from("decision_training_dataset").select("id", { count: "exact", head: true }).eq("label_source", "measured"),
        supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("silent_failure_state").select("id", { count: "exact", head: true }).is("resolved_at", null),
        supabase.from("decision_outcome_log").select("domain").eq("evidence_type", "measured"),
      ]);

      // Domain breakdown
      const domainCounts: Record<string, number> = {};
      (domains.data ?? []).forEach(d => {
        const dm = (d as any).domain || "unknown";
        domainCounts[dm] = (domainCounts[dm] || 0) + 1;
      });

      const totalC = total.count ?? 0;
      const acceptedC = accepted.count ?? 0;
      const measuredC = measured.count ?? 0;
      const failedC = failed.count ?? 0;
      const postmortemC = postmortems.count ?? 0;

      return {
        total: totalC,
        accepted: acceptedC,
        executed: executed.count ?? 0,
        completed: completed.count ?? 0,
        measured: measuredC,
        measuredThisWeek: measuredWeek.count ?? 0,
        failed: failedC,
        postmortems: postmortemC,
        postmortemRate: failedC > 0 ? Math.round((postmortemC / failedC) * 100) : 0,
        withROI: withROI.count ?? 0,
        proxyTraining: proxy.count ?? 0,
        realTraining: real.count ?? 0,
        measuredTraining: measuredTD.count ?? 0,
        auditEventsWeek: auditCount.count ?? 0,
        activeSilentFailures: silentFailures.count ?? 0,
        topDomains: Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
        improving: (measuredWeek.count ?? 0) > 0,
      };
    },
    refetchInterval: 30000,
  });

  const rows: { label: string; value: string | number; verdict?: "good" | "warn" | "bad" }[] = data ? [
    { label: "Total Decisions", value: data.total },
    { label: "Accepted", value: data.accepted },
    { label: "Executed", value: data.executed },
    { label: "Completed", value: data.completed },
    { label: "Measured Outcomes", value: data.measured, verdict: data.measured >= 10 ? "good" : data.measured >= 5 ? "warn" : "bad" },
    { label: "Measured This Week", value: data.measuredThisWeek, verdict: data.measuredThisWeek > 0 ? "good" : "bad" },
    { label: "Failed Decisions", value: data.failed },
    { label: "Postmortem Rate", value: `${data.postmortemRate}%`, verdict: data.postmortemRate >= 80 ? "good" : "warn" },
    { label: "With ROI", value: data.withROI },
    { label: "Proxy Training", value: data.proxyTraining },
    { label: "Real/Measured Training", value: data.realTraining + data.measuredTraining },
    { label: "Audit Events (7d)", value: data.auditEventsWeek },
    { label: "Active Silent Failures", value: data.activeSilentFailures, verdict: data.activeSilentFailures === 0 ? "good" : "bad" },
  ] : [];

  const verdictColor = (v?: "good" | "warn" | "bad") => {
    if (v === "good") return "text-green-500";
    if (v === "warn") return "text-yellow-500";
    if (v === "bad") return "text-red-500";
    return "";
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-primary" /> Pilot Conversion Report
          </CardTitle>
          <Badge variant={data?.improving ? "default" : "destructive"} className="text-xs">
            {data?.improving ? "Improving" : "Stagnant"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Is AICIS improving every day from live usage?
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className={`text-sm font-mono font-semibold ${verdictColor(r.verdict)}`}>{r.value}</span>
            </div>
          ))}
        </div>

        {data?.topDomains && data.topDomains.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Top Domains by Measured Evidence</p>
            <div className="flex flex-wrap gap-1.5">
              {data.topDomains.map(([domain, count]) => (
                <Badge key={domain} variant="secondary" className="text-[10px]">{domain}: {count}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
