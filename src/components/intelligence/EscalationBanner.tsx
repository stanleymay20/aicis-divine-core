/**
 * Escalation Banner
 * Surfaces critical/high signals requiring human acknowledgment.
 */
import { useIntelligenceMemory } from "@/contexts/IntelligenceMemoryContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export const EscalationBanner = () => {
  const { criticalSignals, acknowledgeSignal } = useIntelligenceMemory();

  if (criticalSignals.length === 0) return null;

  return (
    <div className="space-y-2">
      {criticalSignals.slice(0, 3).map(signal => (
        <div
          key={signal.id}
          className={cn(
            "border rounded-lg p-3 flex items-start gap-3",
            signal.severity === "critical"
              ? "border-destructive/50 bg-destructive/5"
              : "border-warning/50 bg-warning/5"
          )}
        >
          <AlertTriangle className={cn(
            "h-5 w-5 mt-0.5 shrink-0",
            signal.severity === "critical" ? "text-destructive" : "text-warning"
          )} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">{signal.title}</span>
              <Badge
                variant={signal.severity === "critical" ? "destructive" : "secondary"}
                className="text-[9px]"
              >
                {signal.severity.toUpperCase()} ESCALATION
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{signal.description}</p>
            {signal.escalation_reason && (
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                Escalation reason: {signal.escalation_reason}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex gap-1">
                {signal.domains.map(d => (
                  <Badge key={d} variant="outline" className="text-[9px]">{d}</Badge>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground ml-auto">
                Confidence: {signal.confidence}%
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs gap-1"
            onClick={() => acknowledgeSignal(signal.id)}
          >
            <CheckCircle className="h-3 w-3" />
            Acknowledge
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Shield className="h-3 w-3" />
        <span>Advisory only — no autonomous action. Human acknowledgment required.</span>
      </div>
    </div>
  );
};
