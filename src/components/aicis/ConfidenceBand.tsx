import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle,
  Info 
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ScenarioBand {
  best: number;
  expected: number;
  worst: number;
  unit?: string;
}

export interface ConfidenceInterval {
  low: number;
  high: number;
}

interface ConfidenceBandProps {
  confidence: ConfidenceInterval;
  scenario?: ScenarioBand;
  trend?: "increasing" | "decreasing" | "stable";
  showScenario?: boolean;
  className?: string;
}

/**
 * Probabilistic Forecasting Doctrine
 * - Never claim certainty (cap at 95%)
 * - Always show confidence intervals
 * - Display best/expected/worst scenarios
 * - Use "likelihood" and "trajectory" language
 */
export function capConfidence(value: number): number {
  // Never exceed 95% - matches military/WHO standards
  return Math.min(Math.max(value, 0), 95);
}

export function getConfidenceLabel(interval: ConfidenceInterval): string {
  const avg = (interval.low + interval.high) / 2;
  if (avg >= 80) return "High Confidence";
  if (avg >= 60) return "Moderate Confidence";
  if (avg >= 40) return "Low Confidence";
  return "Very Low Confidence";
}

export function getConfidenceColor(interval: ConfidenceInterval): string {
  const avg = (interval.low + interval.high) / 2;
  if (avg >= 80) return "text-success";
  if (avg >= 60) return "text-warning";
  return "text-destructive";
}

export const ConfidenceBand = ({ 
  confidence, 
  scenario,
  trend,
  showScenario = true,
  className 
}: ConfidenceBandProps) => {
  const cappedLow = capConfidence(confidence.low);
  const cappedHigh = capConfidence(confidence.high);
  const label = getConfidenceLabel({ low: cappedLow, high: cappedHigh });
  const colorClass = getConfidenceColor({ low: cappedLow, high: cappedHigh });
  
  const TrendIcon = trend === "increasing" ? TrendingUp : 
                    trend === "decreasing" ? TrendingDown : Minus;

  return (
    <TooltipProvider>
      <div className={cn("space-y-2", className)}>
        {/* Confidence Interval */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={cn("gap-1.5 cursor-help", 
                  cappedHigh >= 80 ? "border-success/30" :
                  cappedHigh >= 60 ? "border-warning/30" : "border-destructive/30"
                )}
              >
                <span className={cn("font-mono text-xs", colorClass)}>
                  {cappedLow}–{cappedHigh}%
                </span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-2 text-xs">
                <p className="font-medium">{label}</p>
                <p className="text-muted-foreground">
                  Probability range based on available data quality, source verification, 
                  and historical accuracy calibration.
                </p>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Maximum confidence capped at 95% per forecasting doctrine.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
          
          {trend && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className={cn("gap-1 cursor-help",
                    trend === "increasing" && "text-destructive",
                    trend === "decreasing" && "text-success",
                    trend === "stable" && "text-muted-foreground"
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  <span className="text-[10px] capitalize">{trend}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Risk trajectory: {trend}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {/* Scenario Band */}
        {showScenario && scenario && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded bg-success/10 border border-success/20 cursor-help">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Best Case
                  </div>
                  <div className="font-mono text-success">
                    {scenario.best}{scenario.unit}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Optimistic scenario based on favorable conditions</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded bg-primary/10 border border-primary/20 cursor-help">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Expected
                  </div>
                  <div className="font-mono text-primary font-medium">
                    {scenario.expected}{scenario.unit}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Most likely outcome based on current trajectory</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded bg-destructive/10 border border-destructive/20 cursor-help">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                    Worst Case
                  </div>
                  <div className="font-mono text-destructive">
                    {scenario.worst}{scenario.unit}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Pessimistic scenario if risk factors materialize</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

// Simple inline confidence display
export const InlineConfidence = ({ 
  low, 
  high, 
  className 
}: { 
  low: number; 
  high: number; 
  className?: string;
}) => {
  const cappedLow = capConfidence(low);
  const cappedHigh = capConfidence(high);
  const colorClass = getConfidenceColor({ low: cappedLow, high: cappedHigh });
  
  return (
    <span className={cn("font-mono text-xs", colorClass, className)}>
      {cappedLow}–{cappedHigh}%
    </span>
  );
};
