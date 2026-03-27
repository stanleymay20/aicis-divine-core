import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const EXPECTED_EVENTS = [
  "decision.accepted",
  "reviewer.assigned",
  "decision.execution_started",
  "decision.execution_completed",
  "decision.outcome_recorded",
  "measured_evidence_confirmed",
];

export default function AuditCompletenessChecker() {
  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ["audit-completeness"],
    queryFn: async () => {
      const { data: decs } = await supabase.from("decision_outcome_log")
        .select("id, signal_title, signal_id, domain")
        .eq("recommendation_accepted", true)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!decs?.length) return [];

      const ids = decs.map(d => d.signal_id);
      const { data: audits } = await supabase.from("audit_log")
        .select("action, resource_id")
        .in("resource_id", ids);

      const auditMap = new Map<string, Set<string>>();
      (audits ?? []).forEach(a => {
        if (!a.resource_id) return;
        if (!auditMap.has(a.resource_id)) auditMap.set(a.resource_id, new Set());
        auditMap.get(a.resource_id)!.add(a.action);
      });

      return decs.map(d => {
        const events = auditMap.get(d.signal_id) ?? new Set<string>();
        const missing = EXPECTED_EVENTS.filter(e => !events.has(e));
        return { ...d, presentEvents: events.size, missingEvents: missing, totalExpected: EXPECTED_EVENTS.length };
      });
    },
  });

  if (isLoading) return <PanelSkeleton variant="list" rows={5} />;

  const complete = decisions.filter(d => d.missingEvents.length === 0).length;
  const total = decisions.length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <ErrorBoundary compact>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Audit Completeness
            </CardTitle>
            <Badge variant={pct >= 80 ? "default" : "destructive"} className="text-xs font-mono">{pct}%</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No accepted decisions to audit</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {decisions.map(d => (
                  <div key={d.id} className={`p-2.5 rounded-lg border ${d.missingEvents.length === 0 ? "border-green-500/20 bg-green-500/5" : "border-border/30"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium truncate max-w-[200px]">{d.signal_title}</p>
                      <Badge variant="outline" className="text-[10px]">{d.presentEvents}/{d.totalExpected}</Badge>
                    </div>
                    {d.missingEvents.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {d.missingEvents.map(e => (
                          <Badge key={e} variant="destructive" className="text-[9px] h-4 gap-0.5">
                            <AlertCircle className="h-2.5 w-2.5" /> {e.replace("decision.", "").replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}
