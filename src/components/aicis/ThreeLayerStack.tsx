/**
 * Three-Layer Intelligence Stack Visualization
 * Shows: Research → Validation → Decision Intelligence layers
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Search, 
  ShieldCheck, 
  Briefcase,
  ArrowRight,
  ChevronRight
} from "lucide-react";

interface LayerStatusItem {
  active: boolean;
  signalsProcessed?: number;
  sourcesVerified?: number;
  pendingApprovals?: number;
}

export interface LayerStatus {
  research: LayerStatusItem;
  validation: LayerStatusItem;
  decision: LayerStatusItem;
}

interface ThreeLayerStackProps {
  status?: LayerStatus;
  compact?: boolean;
  className?: string;
}

const LAYERS = [
  {
    id: "research",
    name: "Research & Signal Intake",
    shortName: "Research",
    icon: Search,
    description: "Scans public sources for emerging signals, anomalies, and weak trends",
    outputs: ["Research briefs", "Signal flags", "Confidence-scored insights"],
    color: "primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    textColor: "text-primary"
  },
  {
    id: "validation",
    name: "Validation & Synthesis",
    shortName: "Validation",
    icon: ShieldCheck,
    description: "Triangulates signals using multiple sources, assigns verification levels",
    outputs: ["0-95% confidence", "Verification tiers", "Data completeness"],
    color: "warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    textColor: "text-warning"
  },
  {
    id: "decision",
    name: "Decision Intelligence",
    shortName: "Decision",
    icon: Briefcase,
    description: "Converts validated intelligence into actionable dashboards and guidance",
    outputs: ["Dashboards", "Scenario models", "Strategic guidance"],
    color: "success",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    textColor: "text-success"
  }
];

export const ThreeLayerStack = ({ 
  status,
  compact = false,
  className 
}: ThreeLayerStackProps) => {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {LAYERS.map((layer, idx) => {
          const Icon = layer.icon;
          const isActive = status?.[layer.id as keyof LayerStatus]?.active !== false;
          return (
            <div key={layer.id} className="flex items-center">
              <div 
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium",
                  isActive ? layer.bgColor : "bg-muted/30",
                  isActive ? layer.textColor : "text-muted-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{layer.shortName}</span>
              </div>
              {idx < LAYERS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Three-Layer Intelligence Stack
          <Badge variant="outline" className="text-[10px]">Architecture</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Evidence-based truth filtering — AI advises, humans decide
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {LAYERS.map((layer, idx) => {
            const Icon = layer.icon;
            const layerStatus = status?.[layer.id as keyof LayerStatus];
            const isActive = layerStatus?.active !== false;
            
            return (
              <div key={layer.id} className="relative">
                <div 
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    isActive ? layer.bgColor : "bg-muted/20",
                    isActive ? layer.borderColor : "border-border/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isActive ? layer.bgColor : "bg-muted/30"
                      )}>
                        <Icon className={cn(
                          "h-4 w-4",
                          isActive ? layer.textColor : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={cn(
                            "font-semibold text-sm",
                            isActive ? layer.textColor : "text-muted-foreground"
                          )}>
                            Layer {idx + 1}: {layer.name}
                          </h4>
                          <Badge 
                            variant={isActive ? "default" : "secondary"}
                            className={cn(
                              "text-[9px] px-1.5 py-0",
                              isActive && layer.bgColor,
                              isActive && layer.textColor
                            )}
                          >
                            {isActive ? "Active" : "Standby"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {layer.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {layer.outputs.map((output, i) => (
                            <Badge 
                              key={i}
                              variant="outline" 
                              className="text-[9px] px-1.5 py-0"
                            >
                              {output}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Status Metric */}
                    {layerStatus && (
                      <div className="text-right">
                        {layer.id === "research" && layerStatus.signalsProcessed !== undefined && (
                          <div className="font-mono text-lg font-bold">
                            {layerStatus.signalsProcessed}
                            <span className="text-xs text-muted-foreground ml-1">signals</span>
                          </div>
                        )}
                        {layer.id === "validation" && layerStatus.sourcesVerified !== undefined && (
                          <div className="font-mono text-lg font-bold">
                            {layerStatus.sourcesVerified}
                            <span className="text-xs text-muted-foreground ml-1">sources</span>
                          </div>
                        )}
                        {layer.id === "decision" && layerStatus.pendingApprovals !== undefined && (
                          <div className="font-mono text-lg font-bold">
                            {layerStatus.pendingApprovals}
                            <span className="text-xs text-muted-foreground ml-1">pending</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Arrow connector */}
                {idx < LAYERS.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Human-in-the-Loop Banner */}
        <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/30">
          <div className="flex items-center gap-2 text-xs text-accent-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Human-in-the-Loop Governance</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">All outputs require human approval before action</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Minimal badge for embedding in other components
export const IntelligenceLayerBadge = ({ 
  layer, 
  className 
}: { 
  layer: "research" | "validation" | "decision"; 
  className?: string;
}) => {
  const config = LAYERS.find(l => l.id === layer);
  if (!config) return null;
  
  const Icon = config.icon;
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 text-[10px]",
        config.borderColor,
        config.textColor,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.shortName}
    </Badge>
  );
};
