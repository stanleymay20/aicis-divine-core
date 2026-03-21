import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, BarChart3, AlertTriangle } from "lucide-react";

export default function InferenceActivityPanel() {
  const { data } = useQuery({
    queryKey: ["inference-activity"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

      // Inference audit counts
      const [todayRes, weekRes, totalRes] = await Promise.all([
        supabase.from("decision_inference_audit").select("id", { count: "exact", head: true }).gte("inferred_at", todayStart.toISOString()),
        supabase.from("decision_inference_audit").select("id", { count: "exact", head: true }).gte("inferred_at", sevenDaysAgo.toISOString()),
        supabase.from("decision_inference_audit").select("id", { count: "exact", head: true }),
      ]);

      const infToday = todayRes.count ?? 0;
      const infWeek = weekRes.count ?? 0;
      const infTotal = totalRes.count ?? 0;

      // Decision outcome log counts for funnel
      const { data: outcomes } = await supabase
        .from("decision_outcome_log")
        .select("id, recommendation_accepted, action_taken, outcome_success, evidence_type");

      const all = (outcomes as any[]) || [];
      const captured = all.length;
      const executed = all.filter(r => r.action_taken === true).length;
      const measured = all.filter(r => r.evidence_type === "measured").length;

      // Audit coverage: % of inferences that got captured to decision log
      const capturedPct = infTotal > 0 ? Math.round((captured / infTotal) * 100) : 0;
      const executedPct = captured > 0 ? Math.round((executed / captured) * 100) : 0;
      const measuredPct = captured > 0 ? Math.round((measured / captured) * 100) : 0;

      return {
        infToday, infWeek, infTotal,
        captured, executed, measured,
        capturedPct, executedPct, measuredPct,
        auditedPct: 100, // all inferences write audit rows by design
      };
    },
    staleTime: 30_000,
  });

  if (!data) return null;

  const noActivity = data.infToday === 0 && data.infWeek === 0;

  return (
    <Card className={noActivity ? "border-destructive/30" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> Inference Activity & Evidence Funnel
          {noActivity && <Badge variant="destructive" className="text-[9px] h-4">No recent activity</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
          <StatBox label="Today" value={data.infToday} warn={data.infToday === 0} />
          <StatBox label="Last 7d" value={data.infWeek} />
          <StatBox label="Total" value={data.infTotal} />
          <StatBox label="Audited" value={`${data.auditedPct}%`} />
        </div>

        {/* Funnel */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Inference → Decision → Execution → Outcome Funnel</p>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <FunnelStep label="Inferences" value={data.infTotal} pct={100} />
            <FunnelStep label="Captured" value={data.captured} pct={data.capturedPct} />
            <FunnelStep label="Executed" value={data.executed} pct={data.executedPct} />
            <FunnelStep label="Measured" value={data.measured} pct={data.measuredPct} highlight />
          </div>
        </div>

        {data.measuredPct === 0 && data.captured > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-destructive p-2 rounded bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>No inferences have reached measured outcome status. Learning loop is not activated.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`p-2 rounded ${warn ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
      <p className={`text-sm font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function FunnelStep({ label, value, pct, highlight }: { label: string; value: number; pct: number; highlight?: boolean }) {
  return (
    <div className={`p-1.5 rounded ${highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
      <p className={`text-xs font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <div className="w-full bg-muted/50 rounded-full h-1 mt-1">
        <div className={`h-1 rounded-full ${highlight ? "bg-primary" : "bg-foreground/30"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-[8px] text-muted-foreground">{pct}%</p>
    </div>
  );
}
