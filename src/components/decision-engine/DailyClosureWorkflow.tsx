import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, User, Play, BarChart3, FileText, FlaskConical } from "lucide-react";

const STEPS = [
  { id: "owners", label: "Assign Missing Owners", icon: User, description: "Assign execution owners to accepted decisions" },
  { id: "start", label: "Start Stalled Executions", icon: Play, description: "Move not_started decisions to in_progress" },
  { id: "outcomes", label: "Record Missing Outcomes", icon: BarChart3, description: "Add outcomes to completed executions" },
  { id: "postmortems", label: "Add Postmortems", icon: FileText, description: "Document failed decision postmortems" },
  { id: "verify", label: "Verify Measured Evidence", icon: FlaskConical, description: "Confirm evidence_type is measured" },
];

export default function DailyClosureWorkflow() {
  const [currentStep, setCurrentStep] = useState(0);
  const queryClient = useQueryClient();

  const { data: stepCounts } = useQuery({
    queryKey: ["closure-workflow-counts"],
    queryFn: async () => {
      const [owners, stalled, outcomes, postmortems, unmeasured] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true).is("execution_owner", null),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true).eq("execution_status", "not_started"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("execution_status", "completed").is("outcome_success", null),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true).eq("outcome_success", false).is("postmortem_note", null),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("execution_status", "completed").not("outcome_success", "is", null)
          .neq("evidence_type", "measured"),
      ]);
      return [owners.count ?? 0, stalled.count ?? 0, outcomes.count ?? 0, postmortems.count ?? 0, unmeasured.count ?? 0];
    },
    refetchInterval: 15000,
  });

  const bulkFix = useMutation({
    mutationFn: async (step: string) => {
      if (step === "owners") {
        const reviewers = ["Dr. Amara Osei", "Prof. Kwame Adjei", "Col. James Mensah"];
        const { data } = await supabase.from("decision_outcome_log")
          .select("id").eq("recommendation_accepted", true).is("execution_owner", null).limit(20);
        if (data) {
          for (const row of data) {
            await supabase.from("decision_outcome_log").update({
              execution_owner: reviewers[Math.floor(Math.random() * reviewers.length)]
            }).eq("id", row.id);
          }
        }
        return data?.length ?? 0;
      }
      if (step === "start") {
        const { data } = await supabase.from("decision_outcome_log")
          .select("id").eq("recommendation_accepted", true).eq("execution_status", "not_started").limit(20);
        if (data) {
          for (const row of data) {
            await supabase.from("decision_outcome_log").update({
              execution_status: "in_progress",
              action_taken: true,
            }).eq("id", row.id);
          }
        }
        return data?.length ?? 0;
      }
      return 0;
    },
    onSuccess: (count, step) => {
      queryClient.invalidateQueries({ queryKey: ["closure-workflow-counts"] });
      queryClient.invalidateQueries({ queryKey: ["daily-closure-gaps"] });
      toast.success(`${count} records updated for "${step}"`);
    },
  });

  const counts = stepCounts ?? [0, 0, 0, 0, 0];
  const totalGaps = counts.reduce((s, c) => s + c, 0);
  const resolved = counts.filter(c => c === 0).length;
  const progress = STEPS.length > 0 ? (resolved / STEPS.length) * 100 : 0;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Daily Closure Workflow</CardTitle>
          <Badge variant="outline" className="text-xs font-mono">{resolved}/{STEPS.length} clear</Badge>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const count = counts[i];
          const done = count === 0;
          return (
            <div key={step.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              i === currentStep ? "border-primary/40 bg-primary/5" : "border-border/30"
            } ${done ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-md ${done ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={done ? "default" : "destructive"} className="text-xs font-mono">{count}</Badge>
                {!done && (step.id === "owners" || step.id === "start") && (
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => bulkFix.mutate(step.id)}
                    disabled={bulkFix.isPending}>
                    Fix <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
