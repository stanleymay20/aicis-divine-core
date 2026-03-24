import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertOctagon, CheckCircle, Clock } from "lucide-react";

interface FailureState {
  id: string;
  failure_type: string;
  description: string;
  severity: string;
  detected_at: string;
  resolved: boolean;
  resolved_at: string | null;
}

const severityConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive" }> = {
  critical: { variant: "destructive" },
  high: { variant: "destructive" },
  medium: { variant: "secondary" },
  low: { variant: "outline" },
};

export default function SilentFailurePanel() {
  const { data: failures = [] } = useQuery<FailureState[]>({
    queryKey: ["silent-failure-states"],
    queryFn: async () => {
      const { data } = await supabase
        .from("silent_failure_state" as any)
        .select("*")
        .order("detected_at", { ascending: false });
      return (data as any) || [];
    },
    staleTime: 30_000,
  });

  const unresolved = failures.filter(f => !f.resolved);
  const resolved = failures.filter(f => f.resolved);
  const critical = unresolved.filter(f => f.severity === "critical" || f.severity === "high");

  if (failures.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <CheckCircle className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No silent failures detected. System operational.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={critical.length > 0 ? "border-destructive/50" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <AlertOctagon className="h-3.5 w-3.5 text-destructive" /> Silent Failure Monitor
          {unresolved.length > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4">{unresolved.length} active</Badge>
          )}
          {unresolved.length === 0 && (
            <Badge variant="default" className="text-[9px] h-4">All clear</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {unresolved.length > 0 && (
          <div className="space-y-1.5">
            {unresolved.map(f => {
              const sv = severityConfig[f.severity] || severityConfig.medium;
              return (
                <div key={f.id} className="flex items-start gap-2 p-2 rounded bg-destructive/5 border border-destructive/20">
                  <AlertOctagon className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium">{f.failure_type.replace(/_/g, " ")}</span>
                      <Badge variant={sv.variant} className="text-[9px] h-4">{f.severity}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{f.description}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      Detected: {new Date(f.detected_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {critical.length > 0 && (
          <div className="text-[10px] p-2 rounded bg-destructive/10 border border-destructive/20">
            <span className="font-medium text-destructive">⚠ Model promotion is blocked</span>
            <span className="text-muted-foreground ml-1">while {critical.length} critical failure(s) remain unresolved.</span>
          </div>
        )}

        {resolved.length > 0 && (
          <div className="pt-1">
            <p className="text-[10px] text-muted-foreground mb-1">Recently Resolved ({resolved.length})</p>
            {resolved.slice(0, 3).map(f => (
              <div key={f.id} className="flex items-center gap-2 text-[10px] text-muted-foreground py-0.5">
                <CheckCircle className="h-3 w-3 text-primary shrink-0" />
                <span>{f.failure_type.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
