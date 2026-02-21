import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Clock, Shield, MapPin, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntelligenceResult, DashboardCard } from "./IntelligenceQueryBar";
import { DataFreshnessBadge, getFreshnessLevel, getFreshnessConfig } from "./DataFreshnessBadge";
import { VerificationScore, calculateVerificationScore, type SourceInfo } from "./VerificationScore";
import { InlineConfidence } from "./ConfidenceBand";
import { AuditTrailExport } from "./AuditTrailExport";

interface IntelligenceAssessmentProps {
  result: IntelligenceResult;
  onLocationClick?: (location: { name: string; iso3?: string; lat?: number; lng?: number }) => void;
}

const SeverityBadge = ({ severity }: { severity: string }) => {
  const config = {
    low: { color: "bg-success/20 text-success border-success/30", label: "LOW" },
    medium: { color: "bg-warning/20 text-warning border-warning/30", label: "MEDIUM" },
    high: { color: "bg-warning/20 text-warning border-warning/30", label: "HIGH" },
    critical: { color: "bg-destructive/20 text-destructive border-destructive/30 animate-pulse", label: "CRITICAL" },
  };
  
  const { color, label } = config[severity as keyof typeof config] || config.medium;
  
  return (
    <Badge className={cn("font-bold text-sm px-3 py-1", color)}>
      {severity === "critical" && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
      {label}
    </Badge>
  );
};

const TrendIndicator = ({ trend, value }: { trend?: "up" | "down" | "stable"; value?: string }) => {
  if (!trend) return null;
  
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const color = trend === "up" ? "text-destructive" : trend === "down" ? "text-success" : "text-muted-foreground";
  
  return (
    <div className={cn("flex items-center gap-1 text-xs", color)}>
      <Icon className="h-3 w-3" />
      {value && <span>{value}</span>}
    </div>
  );
};

const DashboardCardComponent = ({ card }: { card: DashboardCard }) => {
  const riskColors = {
    low: "border-success/30",
    medium: "border-warning/30",
    high: "border-orange-500/30",
    critical: "border-destructive/30",
  };

  const freshnessLevel = getFreshnessLevel(card.source ? new Date().toISOString() : null);

  return (
    <Card className={cn(
      "bg-muted/30",
      card.riskLevel && riskColors[card.riskLevel]
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{card.title}</span>
          <div className="flex items-center gap-1">
            <DataFreshnessBadge 
              lastUpdated={new Date().toISOString()} 
              showLabel={false}
            />
            {card.riskLevel && (
              <div className={cn(
                "w-2 h-2 rounded-full",
                card.riskLevel === "low" && "bg-success",
                card.riskLevel === "medium" && "bg-warning",
                card.riskLevel === "high" && "bg-warning",
                card.riskLevel === "critical" && "bg-destructive animate-pulse"
              )} />
            )}
          </div>
        </div>
        
        <div className="flex items-end justify-between">
          <div className="text-2xl font-bold font-orbitron">{card.value}</div>
          <TrendIndicator trend={card.trend} value={card.trendValue} />
        </div>
        
        {card.source && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground">Source: {card.source}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const IntelligenceAssessment = ({ result, onLocationClick }: IntelligenceAssessmentProps) => {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff} minutes ago`;
    return `${Math.floor(diff / 60)} hours ago`;
  };

  // Calculate verification score from sources
  const sourceInfos: SourceInfo[] = result.sources.map(s => ({
    name: s,
    type: s.toLowerCase().includes("gdelt") ? "aggregator" :
          s.toLowerCase().includes("world bank") ? "government" :
          s.toLowerCase().includes("who") ? "government" :
          s.toLowerCase().includes("fao") ? "government" :
          s.toLowerCase().includes("satellite") ? "satellite" :
          s.toLowerCase().includes("news") ? "media" : "aggregator"
  }));
  
  const verificationScore = calculateVerificationScore(sourceInfos);

  // Group dashboards by division
  const dashboardsByDivision = result.dashboards.reduce((acc, card) => {
    const div = card.division || "General";
    if (!acc[div]) acc[div] = [];
    acc[div].push(card);
    return acc;
  }, {} as Record<string, DashboardCard[]>);

  return (
    <div className="space-y-6">
      {/* Executive Summary Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-card to-muted/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-orbitron flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                AICIS Global Intelligence Assessment
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Query: "{result.query}"
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DataFreshnessBadge lastUpdated={result.lastUpdated} />
              <AuditTrailExport 
                queryText={result.query}
                sources={result.sources}
                confidence={result.confidence}
                division={result.divisions[0] || "system"}
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Severity, Confidence, Verification Row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Severity:</span>
              <SeverityBadge severity={result.severity} />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Confidence:</span>
              <InlineConfidence low={result.confidence - 10} high={Math.min(result.confidence + 5, 95)} />
            </div>
            
            <VerificationScore score={verificationScore} sources={sourceInfos} showDetails />

            {result.location && (
              <div 
                className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                onClick={() => onLocationClick?.(result.location!)}
              >
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm">{result.location.name}</span>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </div>

          {/* Divisions Affected */}
          {result.divisions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Divisions:</span>
              {result.divisions.map((div, i) => (
                <Badge key={i} variant="secondary" className="text-xs capitalize">
                  {div}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Generated Dashboards */}
      {Object.keys(dashboardsByDivision).length > 0 && (
        <div className="space-y-4">
          {Object.entries(dashboardsByDivision).map(([division, cards]) => (
            <div key={division}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {division}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card) => (
                  <DashboardCardComponent key={card.id} card={card} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sources with verification info */}
      {result.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <span className="font-medium">Data Sources:</span>
          {result.sources.map((source, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">
              {source}
            </Badge>
          ))}
          <span className="ml-auto">
            Verification: {verificationScore}/100
          </span>
        </div>
      )}
    </div>
  );
};
