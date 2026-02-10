/**
 * Cross-Domain Intelligence Signal Badge
 * Shows active signals relevant to the current page/domain.
 */
import { useIntelligenceMemory } from "@/contexts/IntelligenceMemoryContext";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Zap, TrendingDown, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const SIGNAL_ICONS = {
  cross_domain: GitBranch,
  confidence_drop: TrendingDown,
  scenario_divergence: Zap,
  escalation: AlertTriangle,
  anomaly_correlation: AlertTriangle,
};

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/20 text-warning border-warning/30",
  high: "bg-destructive/20 text-destructive border-destructive/30",
  critical: "bg-destructive text-destructive-foreground animate-pulse",
};

interface SignalBadgeProps {
  domain?: string;
  country?: string;
  page?: string;
  compact?: boolean;
}

export const SignalBadge = ({ domain, country, page, compact }: SignalBadgeProps) => {
  const { getSignalsForDomain, getSignalsForCountry, getSignalsForPage } = useIntelligenceMemory();

  const relevant = domain
    ? getSignalsForDomain(domain)
    : country
      ? getSignalsForCountry(country)
      : page
        ? getSignalsForPage(page)
        : [];

  if (relevant.length === 0) return null;

  const topSignal = relevant[0];
  const Icon = SIGNAL_ICONS[topSignal.signal_type] || AlertTriangle;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={cn("text-[10px] gap-1", SEVERITY_STYLES[topSignal.severity])}>
            <Icon className="h-3 w-3" />
            {relevant.length}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-semibold text-xs">{topSignal.title}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{topSignal.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="border border-warning/30 bg-warning/5 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-warning" />
        <span className="text-xs font-semibold text-warning">Cross-Domain Intelligence Signal</span>
        <Badge variant="outline" className={cn("text-[10px] ml-auto", SEVERITY_STYLES[topSignal.severity])}>
          {topSignal.severity.toUpperCase()}
        </Badge>
      </div>
      <p className="text-sm text-foreground">{topSignal.title}</p>
      <p className="text-xs text-muted-foreground">{topSignal.description}</p>
      <div className="flex gap-1 flex-wrap">
        {topSignal.domains.map(d => (
          <Badge key={d} variant="outline" className="text-[9px]">{d}</Badge>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Confidence: {topSignal.confidence}% • {new Date(topSignal.created_at).toLocaleString()}
      </div>
    </div>
  );
};
