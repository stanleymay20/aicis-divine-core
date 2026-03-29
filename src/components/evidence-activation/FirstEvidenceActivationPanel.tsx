import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Rocket, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import GuidedOutcomeWizard from "./GuidedOutcomeWizard";

const CHECKLIST = [
  "Choose a live recommendation",
  "Accept recommendation",
  "Assign reviewer",
  "Assign execution owner",
  "Start execution",
  "Complete execution",
  "Record outcome with impact score",
  "Compute ROI & net value",
] as const;

export default function FirstEvidenceActivationPanel() {
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["activation-measured-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("decision_outcome_log")
        .select("*", { count: "exact", head: true })
        .eq("evidence_type", "measured");
      return count ?? 0;
    },
    refetchInterval: 15000,
  });

  const measuredCount = data ?? 0;
  const target = 5;
  const pct = Math.min(100, Math.round((measuredCount / target) * 100));
  const activated = measuredCount >= target;

  return (
    <>
      <Card className={activated ? "border-primary/30 bg-primary/5" : "border-warning/30"}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              First Evidence Activation
            </CardTitle>
            <Badge variant={activated ? "default" : "secondary"} className="text-xs">
              {measuredCount} / {target}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Progress value={pct} className="h-2" />

          {activated ? (
            <p className="text-xs text-primary font-medium">
              ✓ Activation threshold reached — system can now compute reliable trust scores.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Complete {target - measuredCount} more measured outcome{target - measuredCount !== 1 ? "s" : ""} to activate evidence-based trust scoring.
              </p>

              <div className="space-y-1.5">
                {CHECKLIST.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {i < Math.min(measuredCount, CHECKLIST.length) ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={i < measuredCount ? "text-foreground" : "text-muted-foreground"}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                size="sm"
                className="w-full gap-2 mt-2"
                onClick={() => setWizardOpen(true)}
              >
                Start Guided Flow <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {wizardOpen && <GuidedOutcomeWizard onClose={() => setWizardOpen(false)} />}
    </>
  );
}
