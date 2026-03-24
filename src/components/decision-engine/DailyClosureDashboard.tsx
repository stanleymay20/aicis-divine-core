import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Clock, FileWarning, Shield, User } from "lucide-react";

interface GapCategory {
  label: string;
  count: number;
  icon: React.ReactNode;
  severity: "critical" | "high" | "medium" | "low";
}

export default function DailyClosureDashboard() {
  const { data: gaps } = useQuery({
    queryKey: ["daily-closure-gaps"],
    queryFn: async () => {
      const [completedNoOutcome, noOwner, stalledSLA, noPostmortem, missingAudit] = await Promise.all([
        supabase.from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .eq("execution_status", "completed")
          .is("outcome_success", null),
        supabase.from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true)
          .is("execution_owner", null),
        supabase.from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true)
          .eq("execution_status", "not_started")
          .not("review_due_at", "is", null)
          .lt("review_due_at", new Date().toISOString()),
        supabase.from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true)
          .eq("outcome_success", false)
          .is("postmortem_note", null),
        supabase.from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true)
          .is("assigned_reviewer", null),
      ]);

      return {
        completedNoOutcome: completedNoOutcome.count ?? 0,
        noOwner: noOwner.count ?? 0,
        stalledSLA: stalledSLA.count ?? 0,
        noPostmortem: noPostmortem.count ?? 0,
        missingAudit: missingAudit.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  const categories: GapCategory[] = [
    { label: "Completed / No Outcome", count: gaps?.completedNoOutcome ?? 0, icon: <FileWarning className="h-4 w-4" />, severity: "critical" },
    { label: "No Execution Owner", count: gaps?.noOwner ?? 0, icon: <User className="h-4 w-4" />, severity: "high" },
    { label: "Stalled Past SLA", count: gaps?.stalledSLA ?? 0, icon: <Clock className="h-4 w-4" />, severity: "critical" },
    { label: "Failed / No Postmortem", count: gaps?.noPostmortem ?? 0, icon: <AlertTriangle className="h-4 w-4" />, severity: "high" },
    { label: "No Reviewer Assigned", count: gaps?.missingAudit ?? 0, icon: <Shield className="h-4 w-4" />, severity: "medium" },
  ];

  const totalGaps = categories.reduce((s, c) => s + c.count, 0);

  const severityColor = (s: string) => {
    if (s === "critical") return "text-red-500 bg-red-500/10 border-red-500/20";
    if (s === "high") return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Daily Closure Targets</CardTitle>
          <Badge variant={totalGaps === 0 ? "default" : "destructive"} className="text-xs">
            {totalGaps === 0 ? <><CheckCircle2 className="h-3 w-3 mr-1" /> All Clear</> : `${totalGaps} gaps open`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.label} className={`flex items-center justify-between p-2.5 rounded-lg border ${cat.count > 0 ? severityColor(cat.severity) : "border-border/30 text-muted-foreground"}`}>
            <div className="flex items-center gap-2 text-sm">
              {cat.icon}
              <span>{cat.label}</span>
            </div>
            <span className="text-sm font-mono font-semibold">{cat.count}</span>
          </div>
        ))}
        {totalGaps > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Closure progress</span>
              <span>Target: 0 gaps</span>
            </div>
            <Progress value={totalGaps === 0 ? 100 : Math.max(5, 100 - totalGaps * 10)} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
