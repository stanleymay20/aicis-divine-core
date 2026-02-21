import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Shield, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type VerificationLevel = "highly_verified" | "partially_verified" | "unverified" | "unknown";

export interface SourceInfo {
  name: string;
  type: "media" | "satellite" | "government" | "ngo" | "academic" | "aggregator";
  weight?: number;
}

interface VerificationScoreProps {
  score: number; // 0-100
  sources: SourceInfo[];
  showDetails?: boolean;
  className?: string;
}

/**
 * Triangulation Scoring Engine
 * Score is based on:
 * - Source count (more sources = higher confidence)
 * - Source diversity (different types = higher trust)
 * - Individual source weight/reliability
 */
export function calculateVerificationScore(sources: SourceInfo[]): number {
  if (sources.length === 0) return 0;
  
  // Base score from source count (max 40 points)
  const countScore = Math.min(sources.length * 10, 40);
  
  // Diversity score from unique source types (max 30 points)
  const uniqueTypes = new Set(sources.map(s => s.type));
  const diversityScore = Math.min(uniqueTypes.size * 6, 30);
  
  // Weight score from source reliability (max 30 points)
  const typeWeights: Record<string, number> = {
    government: 1.0,
    academic: 0.95,
    satellite: 0.9,
    ngo: 0.85,
    aggregator: 0.75,
    media: 0.7,
  };
  
  const avgWeight = sources.reduce((sum, s) => {
    return sum + (s.weight ?? typeWeights[s.type] ?? 0.5);
  }, 0) / sources.length;
  
  const weightScore = avgWeight * 30;
  
  return Math.round(Math.min(countScore + diversityScore + weightScore, 100));
}

export function getVerificationLevel(score: number): VerificationLevel {
  if (score >= 75) return "highly_verified";
  if (score >= 45) return "partially_verified";
  if (score > 0) return "unverified";
  return "unknown";
}

function getVerificationConfig(level: VerificationLevel) {
  const configs = {
    highly_verified: {
      label: "Highly Verified",
      description: "Multiple independent sources confirm this data",
      color: "bg-success/20 text-success border-success/30",
      icon: ShieldCheck,
    },
    partially_verified: {
      label: "Partially Verified",
      description: "Some source corroboration available",
      color: "bg-warning/20 text-warning border-warning/30",
      icon: Shield,
    },
    unverified: {
      label: "Unverified",
      description: "Limited source verification",
      color: "bg-warning/20 text-warning border-warning/30",
      icon: ShieldAlert,
    },
    unknown: {
      label: "Unknown",
      description: "No verification data available",
      color: "bg-muted text-muted-foreground border-muted",
      icon: ShieldOff,
    },
  };
  
  return configs[level];
}

function getSourceTypeLabel(type: SourceInfo["type"]) {
  const labels: Record<SourceInfo["type"], string> = {
    media: "Media",
    satellite: "Satellite",
    government: "Government",
    ngo: "NGO",
    academic: "Academic",
    aggregator: "Aggregator",
  };
  return labels[type];
}

function getSourceTypeColor(type: SourceInfo["type"]) {
  const colors: Record<SourceInfo["type"], string> = {
    media: "bg-primary/20 text-primary border-primary/30",
    satellite: "bg-accent/20 text-accent border-accent/30",
    government: "bg-success/20 text-success border-success/30",
    ngo: "bg-warning/20 text-warning border-warning/30",
    academic: "bg-secondary/20 text-secondary border-secondary/30",
    aggregator: "bg-muted/20 text-muted-foreground border-muted/20",
  };
  return colors[type];
}

export const VerificationScore = ({ 
  score, 
  sources, 
  showDetails = false,
  className 
}: VerificationScoreProps) => {
  const level = getVerificationLevel(score);
  const config = getVerificationConfig(level);
  const Icon = config.icon;
  
  // Group sources by type
  const sourcesByType = sources.reduce((acc, source) => {
    if (!acc[source.type]) acc[source.type] = [];
    acc[source.type].push(source);
    return acc;
  }, {} as Record<string, SourceInfo[]>);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("inline-flex items-center gap-2 cursor-help", className)}>
          <Badge 
            variant="outline" 
            className={cn(config.color, "gap-1.5")}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium">{config.label}</span>
          </Badge>
          
          {showDetails && (
            <span className="text-xs text-muted-foreground font-mono">
              {score}/100
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <p className="font-medium flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" />
            {config.description}
          </p>
          
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground">
              Verification Score: <span className="font-mono text-foreground">{score}/100</span>
            </p>
            <p className="text-muted-foreground">
              Sources: <span className="font-mono text-foreground">{sources.length}</span>
            </p>
            <p className="text-muted-foreground">
              Type Diversity: <span className="font-mono text-foreground">{Object.keys(sourcesByType).length} types</span>
            </p>
          </div>
          
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
              {sources.slice(0, 6).map((source, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className={cn("text-[9px]", getSourceTypeColor(source.type))}
                >
                  {source.name}
                </Badge>
              ))}
              {sources.length > 6 && (
                <Badge variant="outline" className="text-[9px]">
                  +{sources.length - 6} more
                </Badge>
              )}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Compact version for dashboard cards
export const VerificationDot = ({ score, className }: { score: number; className?: string }) => {
  const level = getVerificationLevel(score);
  const colors = {
    highly_verified: "bg-success",
    partially_verified: "bg-warning",
    unverified: "bg-warning",
    unknown: "bg-muted-foreground",
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("w-2 h-2 rounded-full cursor-help", colors[level], className)} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Verification: {score}/100
      </TooltipContent>
    </Tooltip>
  );
};
