import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, Shield, AlertTriangle, Cpu, Target } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PilotTruthReport() {
  const { data } = useQuery({
    queryKey: ["pilot-truth-report"],
    queryFn: async () => {
      const [
        totalRes, acceptedRes, actedRes, completedRes,
        measuredRes, failedRes, pmRes,
        roiDataRes, trainingRes,
        silentRes, modelRes, trustRes
      ] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("recommendation_accepted", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("action_taken", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("execution_status", "completed"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("evidence_type", "measured"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("outcome_success", false).eq("recommendation_accepted", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("outcome_success", false).eq("recommendation_accepted", true).not("postmortem_note", "is", null),
        supabase.from("decision_outcome_log").select("roi_estimate, net_value, outcome_success").not("roi_estimate", "is", null),
        supabase.from("decision_training_dataset").select("label_source, overridden_by_real"),
        supabase.from("silent_failure_state" as any).select("id", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("decision_models").select("version, status, training_mode").eq("status", "active").limit(1),
        supabase.from("system_trust_score" as any).select("*").limit(1),
      ]);

      const roiData = (roiDataRes.data as any[]) || [];
      const avgRoi = roiData.length > 0 ? Math.round(roiData.reduce((s, r) => s + (r.roi_estimate || 0), 0) / roiData.length * 10) / 10 : 0;
      const totalNet = Math.round(roiData.reduce((s, r) => s + (r.net_value || 0), 0) * 10) / 10;
      const outcomeCount = roiData.filter(r => r.outcome_success !== null).length;
      const successCount = roiData.filter(r => r.outcome_success === true).length;

      const training = (trainingRes.data as any[]) || [];
      const proxy = training.filter(r => r.label_source === "proxy" && !r.overridden_by_real).length;
      const tMeasured = training.filter(r => r.label_source === "measured").length;
      const tReal = training.filter(r => r.label_source === "real").length;

      const model = (modelRes.data as any[])?.[0];
      const trust = (trustRes.data as any[])?.[0];

      const total = totalRes.count ?? 0;
      const accepted = acceptedRes.count ?? 0;
      const acted = actedRes.count ?? 0;
      const completed = completedRes.count ?? 0;
      const measured = measuredRes.count ?? 0;
      const failed = failedRes.count ?? 0;
      const withPm = pmRes.count ?? 0;

      return {
        total, accepted, acted, completed, measured, failed,
        pmCompletion: failed > 0 ? Math.round((withPm / failed) * 100) : 100,
        successRate: outcomeCount > 0 ? Math.round((successCount / outcomeCount) * 100) : 0,
        avgRoi, totalNet, outcomeCount,
        silentFailures: silentRes.count ?? 0,
        modelVersion: model?.version || "none",
        modelMode: model?.training_mode || "unknown",
        trustScore: trust?.trust_score ?? 0,
        proxy, tMeasured, tReal,
        trainingTotal: training.length,
        generatedAt: new Date().toISOString(),
      };
    },
    staleTime: 60_000,
  });

  if (!data) return null;

  const rows = [
    { metric: "Total Decisions", value: data.total },
    { metric: "Accepted", value: data.accepted },
    { metric: "Executed (action taken)", value: data.acted },
    { metric: "Completed", value: data.completed },
    { metric: "Outcomes Recorded", value: data.outcomeCount },
    { metric: "Measured Outcomes", value: data.measured },
    { metric: "Success Rate", value: `${data.successRate}%` },
    { metric: "Average ROI", value: data.avgRoi },
    { metric: "Total Net Value", value: data.totalNet },
    { metric: "Postmortem Completion", value: `${data.pmCompletion}%` },
    { metric: "Trust Score", value: `${data.trustScore}/100` },
    { metric: "Active Model", value: data.modelVersion },
    { metric: "Training Mode", value: data.modelMode },
    { metric: "Silent Failures (active)", value: data.silentFailures },
    { metric: "Training: Proxy", value: data.proxy },
    { metric: "Training: Real", value: data.tReal },
    { metric: "Training: Measured", value: data.tMeasured },
    { metric: "Training: Total", value: data.trainingTotal },
  ];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" /> AICIS Pilot Truth Report
          </CardTitle>
          <Badge variant="outline" className="text-[9px]">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={data.measured >= 10 ? "default" : "secondary"} className="text-[9px] gap-1">
            <Target className="h-2.5 w-2.5" />
            {data.measured >= 10 ? "Evidence Credible" : data.measured >= 5 ? "Evidence Emerging" : "Evidence Thin"}
          </Badge>
          <Badge variant={data.silentFailures === 0 ? "default" : "destructive"} className="text-[9px] gap-1">
            <Shield className="h-2.5 w-2.5" />
            {data.silentFailures === 0 ? "No Silent Failures" : `${data.silentFailures} Active Failures`}
          </Badge>
          <Badge variant="outline" className="text-[9px] gap-1">
            <Cpu className="h-2.5 w-2.5" />
            Model: {data.modelVersion}
          </Badge>
          <Badge variant="outline" className="text-[9px] gap-1">
            <TrendingUp className="h-2.5 w-2.5" />
            Trust: {data.trustScore}/100
          </Badge>
        </div>

        {/* Evidence honesty */}
        {data.measured < 10 && (
          <div className="p-2 rounded border border-warning/30 bg-warning/5 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              <strong>Pilot Data Notice:</strong> This report contains {data.measured} measured outcomes.
              Full credibility requires ≥10 measured outcomes with verified impact scores.
              {data.proxy > 0 && ` Training data is ${Math.round((data.proxy / data.trainingTotal) * 100)}% proxy-based.`}
            </p>
          </div>
        )}

        {/* Data table */}
        <div className="border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8">Metric</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.metric}>
                  <TableCell className="text-[10px] py-1.5">{r.metric}</TableCell>
                  <TableCell className="text-[10px] py-1.5 text-right font-mono font-medium">{r.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-[9px] text-muted-foreground text-center">
          AICIS Decision Intelligence — Pilot Truth Report — All values from live database
        </p>
      </CardContent>
    </Card>
  );
}
