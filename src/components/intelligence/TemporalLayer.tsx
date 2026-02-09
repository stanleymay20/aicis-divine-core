/**
 * Temporal Layering Component
 * Visual timeline: Past → Present → Forecast with clear visual delineation
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemporalPhase {
  label: string;
  period: string;
  metrics: { name: string; value: string; trend?: "up" | "down" | "stable" }[];
  type: "past" | "present" | "forecast";
}

interface TemporalLayerProps {
  phases: TemporalPhase[];
  title?: string;
  className?: string;
}

const PHASE_STYLES = {
  past: {
    bg: "bg-muted/30",
    border: "border-muted",
    badge: "secondary" as const,
    icon: "text-muted-foreground",
    label: "Historical",
  },
  present: {
    bg: "bg-primary/5",
    border: "border-primary/30",
    badge: "default" as const,
    icon: "text-primary",
    label: "Current State",
  },
  forecast: {
    bg: "bg-warning/5",
    border: "border-warning/30",
    badge: "outline" as const,
    icon: "text-warning",
    label: "Forecast",
  },
};

export const TemporalLayer = ({ phases, title, className }: TemporalLayerProps) => {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {title || "Temporal Analysis"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Past → Present → Forecast trajectory
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {phases.map((phase, idx) => {
            const style = PHASE_STYLES[phase.type];
            return (
              <div key={idx} className="flex items-stretch gap-2">
                <div
                  className={cn(
                    "flex-1 min-w-[180px] rounded-lg border p-3",
                    style.bg,
                    style.border
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={style.badge} className="text-[10px]">
                      {style.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{phase.period}</span>
                  </div>
                  <p className="text-xs font-semibold mb-2">{phase.label}</p>
                  <div className="space-y-1.5">
                    {phase.metrics.map((m, mIdx) => (
                      <div key={mIdx} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{m.name}</span>
                        <span className={cn(
                          "font-medium",
                          m.trend === "up" && "text-success",
                          m.trend === "down" && "text-destructive",
                        )}>
                          {m.value}
                          {m.trend === "up" && " ↑"}
                          {m.trend === "down" && " ↓"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {idx < phases.length - 1 && (
                  <div className="flex items-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
