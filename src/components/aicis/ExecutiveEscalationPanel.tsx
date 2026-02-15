import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Zap, Activity, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface EscalationItem {
  type: "npi_decline" | "structural_break" | "confidence_collapse" | "drift_alert";
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  iso3?: string;
  domain?: string;
  value?: number;
}

export const ExecutiveEscalationPanel = () => {
  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ["executive-escalations"],
    queryFn: async () => {
      const items: EscalationItem[] = [];

      // 1. Top NPI declines (snapshots with negative momentum)
      const { data: declines } = await supabase
        .from("country_performance_snapshots")
        .select("iso3, domain, performance_index, momentum_score, snapshot_date")
        .lt("momentum_score", -10)
        .order("momentum_score", { ascending: true })
        .limit(3);

      if (declines) {
        for (const d of declines) {
          items.push({
            type: "npi_decline",
            title: `${d.iso3} ${d.domain} declining`,
            detail: `NPI: ${d.performance_index?.toFixed(0) ?? "?"}, Momentum: ${d.momentum_score?.toFixed(1) ?? "?"}`,
            severity: (d.momentum_score ?? 0) < -20 ? "critical" : "warning",
            iso3: d.iso3,
            domain: d.domain,
            value: d.momentum_score ?? 0,
          });
        }
      }

      // 2. Structural break clusters
      const { data: breaks } = await supabase
        .from("forecast_archive")
        .select("iso3, domain, created_at")
        .eq("structural_break_flag", true)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (breaks && breaks.length >= 3) {
        const domains = [...new Set(breaks.map(b => b.domain))];
        items.push({
          type: "structural_break",
          title: `${breaks.length} structural breaks this week`,
          detail: `Domains: ${domains.join(", ")}`,
          severity: breaks.length >= 5 ? "critical" : "warning",
        });
      }

      // 3. Confidence collapse (low confidence forecasts)
      const { data: lowConf } = await supabase
        .from("forecast_archive")
        .select("iso3, domain, confidence_score")
        .lt("confidence_score", 30)
        .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString())
        .order("confidence_score", { ascending: true })
        .limit(3);

      if (lowConf && lowConf.length > 0) {
        items.push({
          type: "confidence_collapse",
          title: `${lowConf.length} low-confidence forecasts`,
          detail: `Lowest: ${lowConf[0].iso3}/${lowConf[0].domain} at ${lowConf[0].confidence_score}%`,
          severity: lowConf[0].confidence_score < 20 ? "critical" : "warning",
        });
      }

      // 4. Active drift alerts
      const { data: driftAlerts } = await supabase
        .from("drift_alerts")
        .select("alert_type, severity, current_value, baseline_value, details")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(3);

      if (driftAlerts) {
        for (const da of driftAlerts) {
          const details = da.details as Record<string, string> | null;
          items.push({
            type: "drift_alert",
            title: da.alert_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            detail: details?.message || `Current: ${da.current_value}, Baseline: ${da.baseline_value}`,
            severity: da.severity as "critical" | "warning" | "info",
          });
        }
      }

      return items.sort((a, b) => {
        const ord = { critical: 0, warning: 1, info: 2 };
        return (ord[a.severity] ?? 2) - (ord[b.severity] ?? 2);
      }).slice(0, 6);
    },
    refetchInterval: 120000,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "npi_decline": return TrendingDown;
      case "structural_break": return Zap;
      case "confidence_collapse": return Activity;
      case "drift_alert": return AlertTriangle;
      default: return Shield;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case "critical": return "border-destructive/50 bg-destructive/5";
      case "warning": return "border-warning/50 bg-warning/5";
      default: return "border-border bg-muted/30";
    }
  };

  if (isLoading) return null;
  if (escalations.length === 0) {
    return (
      <Card className="border-success/30">
        <CardContent className="pt-4 pb-3 text-center">
          <Shield className="h-6 w-6 mx-auto mb-1 text-success opacity-60" />
          <p className="text-xs text-muted-foreground">No active escalations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Executive Escalations
          <Badge variant="outline" className="ml-auto text-[10px]">
            {escalations.filter(e => e.severity === "critical").length} critical
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {escalations.map((item, i) => {
          const Icon = getIcon(item.type);
          return (
            <div key={i} className={cn("rounded-lg border p-2.5 flex items-start gap-2", getSeverityClass(item.severity))}>
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0",
                item.severity === "critical" ? "text-destructive" : "text-warning"
              )} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{item.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{item.detail}</p>
              </div>
              <Badge variant="outline" className={cn("text-[9px] shrink-0",
                item.severity === "critical" ? "border-destructive/50 text-destructive" : "border-warning/50 text-warning"
              )}>
                {item.severity}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
