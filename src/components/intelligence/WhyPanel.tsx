/**
 * "Why This Result?" Explanatory Panel
 * Shows key drivers, assumptions, confidence rationale, and what-would-change analysis
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HelpCircle,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Lightbulb,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Driver {
  label: string;
  influence: number; // 0-100
  direction: "positive" | "negative" | "neutral";
  description?: string;
}

interface WhyPanelProps {
  title?: string;
  confidenceScore: number; // 0-1, will be capped at 0.95
  confidenceRationale: string;
  drivers: Driver[];
  assumptions: string[];
  whatWouldChange: string[];
  dataLabel?: "ai_inference" | "historical_fact" | "forecast" | "scenario";
  className?: string;
  defaultOpen?: boolean;
}

const DATA_LABELS = {
  ai_inference: { label: "AI Inference", color: "bg-primary/10 text-primary border-primary/30" },
  historical_fact: { label: "Historical Fact", color: "bg-success/10 text-success border-success/30" },
  forecast: { label: "Forecast", color: "bg-warning/10 text-warning border-warning/30" },
  scenario: { label: "Scenario", color: "bg-accent/10 text-accent-foreground border-accent/30" },
};

export const WhyPanel = ({
  title = "Why This Result?",
  confidenceScore,
  confidenceRationale,
  drivers,
  assumptions,
  whatWouldChange,
  dataLabel = "ai_inference",
  className,
  defaultOpen = false,
}: WhyPanelProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const cappedConfidence = Math.min(Math.round(confidenceScore * 100), 95);
  const labelConfig = DATA_LABELS[dataLabel];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("border-dashed", className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                {title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs", labelConfig.color)}>
                  {labelConfig.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {cappedConfidence}% confidence
                </Badge>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Confidence Rationale */}
            <div className="p-3 bg-muted/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium mb-1">
                    Why {cappedConfidence}% and not higher?
                  </p>
                  <p className="text-xs text-muted-foreground">{confidenceRationale}</p>
                </div>
              </div>
            </div>

            {/* Key Drivers */}
            <div>
              <h5 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                Key Drivers (ranked by influence)
              </h5>
              <div className="space-y-2">
                {drivers
                  .sort((a, b) => b.influence - a.influence)
                  .map((driver, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-5 text-center">
                        {driver.direction === "positive" ? (
                          <TrendingUp className="h-3.5 w-3.5 text-success" />
                        ) : driver.direction === "negative" ? (
                          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium">{driver.label}</span>
                          <span className="text-[10px] text-muted-foreground">{driver.influence}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              driver.direction === "positive" ? "bg-success" :
                              driver.direction === "negative" ? "bg-destructive" :
                              "bg-muted-foreground"
                            )}
                            style={{ width: `${driver.influence}%` }}
                          />
                        </div>
                        {driver.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{driver.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Assumptions */}
            <div>
              <h5 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Assumptions Used
              </h5>
              <ul className="space-y-1">
                {assumptions.map((a, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-warning mt-0.5">•</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            {/* What Would Change */}
            <div>
              <h5 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                What Would Change This Outcome?
              </h5>
              <ul className="space-y-1">
                {whatWouldChange.map((w, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">→</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust Notice */}
            <div className="text-[10px] text-muted-foreground pt-2 border-t border-dashed">
              All values capped at 95% confidence. Human review required for consequential decisions.
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
