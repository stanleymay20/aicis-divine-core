import { AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GlobalSignal } from "@/hooks/useGlobalSignals";

export function AlertRibbon({ signals }: { signals: GlobalSignal[] }) {
  const critical = signals.filter(s => s.impact_score >= 85 && s.urgency_score >= 70);

  if (critical.length === 0) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 sm:p-3 animate-fade-in">
      <div className="flex items-center gap-2 mb-1.5">
        <Zap className="h-4 w-4 text-red-500 animate-pulse" />
        <span className="text-xs font-semibold text-red-400">
          {critical.length} CRITICAL SIGNAL{critical.length > 1 ? "S" : ""} — Immediate Attention Required
        </span>
      </div>
      <div className="space-y-1">
        {critical.slice(0, 3).map(s => (
          <div key={s.id} className="flex items-start gap-2 text-xs">
            <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
            <span className="text-foreground/90 line-clamp-1">{s.title}</span>
            <span className={cn(
              "shrink-0 text-[10px] font-mono font-bold",
              s.impact_score >= 90 ? "text-red-400" : "text-amber-400"
            )}>
              {s.impact_score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
