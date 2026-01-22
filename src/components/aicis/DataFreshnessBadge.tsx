import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type FreshnessLevel = "live" | "recent" | "stale" | "offline";

interface DataFreshnessBadgeProps {
  lastUpdated: Date | string | null;
  freshnessMinutes?: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * Data Freshness Contracts:
 * 🟢 Live: <15 minutes - Real-time or near real-time data
 * 🟡 Recent: <24 hours - Data from within the last day
 * 🔴 Stale: >24 hours - Data older than one day
 * ⚫ Offline: No data available
 */
export function getFreshnessLevel(lastUpdated: Date | string | null): FreshnessLevel {
  if (!lastUpdated) return "offline";
  
  const timestamp = typeof lastUpdated === "string" ? new Date(lastUpdated) : lastUpdated;
  const minutesAgo = Math.floor((Date.now() - timestamp.getTime()) / 60000);
  
  if (minutesAgo < 15) return "live";
  if (minutesAgo < 60 * 24) return "recent";
  return "stale";
}

export function getFreshnessConfig(level: FreshnessLevel) {
  const configs = {
    live: {
      label: "Live",
      description: "Real-time data (<15 min)",
      color: "bg-success/20 text-success border-success/30",
      dotColor: "bg-success",
      icon: CheckCircle,
      maxConfidence: 95,
    },
    recent: {
      label: "Recent",
      description: "Updated within 24 hours",
      color: "bg-warning/20 text-warning border-warning/30",
      dotColor: "bg-warning",
      icon: Clock,
      maxConfidence: 80,
    },
    stale: {
      label: "Stale",
      description: "Data older than 24 hours",
      color: "bg-destructive/20 text-destructive border-destructive/30",
      dotColor: "bg-destructive",
      icon: AlertCircle,
      maxConfidence: 60,
    },
    offline: {
      label: "Offline",
      description: "No data available",
      color: "bg-muted text-muted-foreground border-muted",
      dotColor: "bg-muted-foreground",
      icon: XCircle,
      maxConfidence: 0,
    },
  };
  
  return configs[level];
}

export const DataFreshnessBadge = ({ 
  lastUpdated, 
  freshnessMinutes,
  showLabel = true,
  className 
}: DataFreshnessBadgeProps) => {
  const level = getFreshnessLevel(lastUpdated);
  const config = getFreshnessConfig(level);
  const Icon = config.icon;
  
  const formatTime = (date: Date | string | null) => {
    if (!date) return "Unknown";
    const timestamp = typeof date === "string" ? new Date(date) : date;
    const minutes = Math.floor((Date.now() - timestamp.getTime()) / 60000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(config.color, "gap-1.5", className)}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", config.dotColor, level === "live" && "animate-pulse")} />
            {showLabel && <span className="text-[10px] font-medium">{config.label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {config.description}
            </p>
            <p className="text-muted-foreground">Last updated: {formatTime(lastUpdated)}</p>
            {freshnessMinutes !== undefined && (
              <p className="text-muted-foreground">SLA: {freshnessMinutes} min freshness target</p>
            )}
            <p className="text-muted-foreground">Max confidence cap: {config.maxConfidence}%</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
