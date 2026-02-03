/**
 * Analyst Mode Toggle
 * Switches between Executive (summary) and Analyst (detailed) views
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Zap, 
  Microscope,
  Eye,
  FileText
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ViewMode = "executive" | "analyst";

interface ModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  className?: string;
}

const MODE_CONFIG = {
  executive: {
    icon: Zap,
    label: "Executive",
    description: "High-level RAG summary with 72h attention window",
    features: ["Summary briefs", "Critical alerts only", "Quick decisions"]
  },
  analyst: {
    icon: Microscope,
    label: "Analyst",
    description: "Detailed data provenance and granular metrics",
    features: ["Full data lineage", "Source verification", "Deep analysis"]
  }
};

export const ModeToggle = ({ 
  mode, 
  onModeChange,
  className 
}: ModeToggleProps) => {
  return (
    <div className={cn("flex items-center gap-1 p-0.5 rounded-lg bg-muted/30 border border-border/50", className)}>
      {(Object.keys(MODE_CONFIG) as ViewMode[]).map((key) => {
        const config = MODE_CONFIG[key];
        const Icon = config.icon;
        const isActive = mode === key;
        
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 px-2 gap-1.5 text-xs",
                  isActive && key === "executive" && "bg-primary text-primary-foreground",
                  isActive && key === "analyst" && "bg-secondary text-secondary-foreground"
                )}
                onClick={() => onModeChange(key)}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{config.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="space-y-2 text-xs">
                <p className="font-semibold">{config.label} Mode</p>
                <p className="text-muted-foreground">{config.description}</p>
                <ul className="space-y-1">
                  {config.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="text-success">•</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

// Badge indicator for current mode
export const ModeBadge = ({ 
  mode, 
  className 
}: { 
  mode: ViewMode; 
  className?: string;
}) => {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 text-[10px]",
        mode === "executive" && "border-primary/30 text-primary",
        mode === "analyst" && "border-secondary/30 text-secondary-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label} Mode
    </Badge>
  );
};

// Hook for managing mode state
export const useViewMode = (defaultMode: ViewMode = "executive") => {
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  return { mode, setMode };
};
