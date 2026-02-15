import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, AlertTriangle, Download, Scale, Database, BarChart3 } from "lucide-react";

const GovernanceLegal = () => {
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <AICISLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto print:max-w-none">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Governance & Legal Framework</h1>
              <p className="text-sm text-muted-foreground">Institutional compliance documentation</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExportPDF} className="print:hidden">
            <Download className="h-4 w-4 mr-2" />
            Export as PDF
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)] print:h-auto">
          <div className="space-y-6">
            {/* Liability Disclaimer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Liability Disclaimer
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  AICIS (Artificial Intelligence Coordination & Intelligence System) provides analytical 
                  outputs, forecasts, and risk assessments generated from publicly available aggregate data. 
                  These outputs are <strong>advisory in nature</strong> and do not constitute policy directives, 
                  investment advice, or operational commands.
                </p>
                <p>
                  <strong>No warranty of accuracy:</strong> All forecasts are probabilistic estimates with 
                  explicitly stated confidence bounds. Confidence scores are hard-capped at 95% to reflect 
                  inherent uncertainty. No forecast should be treated as certain.
                </p>
                <p>
                  <strong>Human-in-the-Loop mandate:</strong> All critical recommendations require multi-role 
                  human approval before implementation. AICIS does not autonomously execute policy decisions.
                </p>
                <p>
                  <strong>Data limitations:</strong> Outputs are constrained by the quality, completeness, and 
                  timeliness of source data. Data staleness is tracked and penalizes confidence scores 
                  automatically. Users should independently verify data before acting on AICIS assessments.
                </p>
              </CardContent>
            </Card>

            {/* Intended Use */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Intended Use Statement
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p><strong>AICIS is designed for:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Government agencies conducting macro-level situation awareness</li>
                  <li>International organizations monitoring SDG progress and crisis indicators</li>
                  <li>Research institutions studying cross-domain risk dynamics</li>
                  <li>Institutional investors assessing sovereign and geopolitical risk</li>
                  <li>Humanitarian organizations for early warning and resource planning</li>
                </ul>
                <p><strong>AICIS is NOT designed for:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Individual surveillance or personal data tracking</li>
                  <li>Automated military or law enforcement operations</li>
                  <li>Real-time trading decisions without human oversight</li>
                  <li>Replacing domain-specific expert analysis</li>
                </ul>
              </CardContent>
            </Card>

            {/* Risk Classification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Risk Classification Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RiskTier level="Critical" color="destructive" threshold="Risk Pressure > 80" action="Immediate escalation, multi-role approval required" />
                  <RiskTier level="High" color="default" threshold="Risk Pressure 60–80" action="Priority review, analyst + policy maker sign-off" />
                  <RiskTier level="Medium" color="secondary" threshold="Risk Pressure 40–60" action="Standard monitoring, periodic review" />
                  <RiskTier level="Low" color="outline" threshold="Risk Pressure < 40" action="Automated monitoring, exception-based alerts" />
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Risk classifications are computed from weighted domain scores, volatility, momentum, and 
                  systemic fragility. Structural breaks automatically escalate risk by +10 points.
                </p>
              </CardContent>
            </Card>

            {/* Data Source Attribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Source Attribution
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <p className="text-muted-foreground">
                  AICIS exclusively uses publicly available, aggregate, non-personal data from 
                  internationally recognized institutions:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SOURCES.map(s => (
                    <div key={s.name} className="flex items-center justify-between p-2 rounded border">
                      <div>
                        <p className="font-medium text-xs">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.type}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{s.domain}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  All data sources are cited in individual assessments. Data freshness is tracked per-source 
                  and displayed via Data Freshness Badges (Live &lt;15m, Recent &lt;24h, Stale &gt;24h).
                </p>
              </CardContent>
            </Card>

            {/* Forecast Interpretation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Forecast Interpretation Guidance
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <div className="space-y-4">
                  <InterpretGuide
                    title="Confidence Scores"
                    desc="Composite metric (10–95%) reflecting data density, source diversity, backtest stability, and staleness penalties. A score of 70% means the model's historical error distribution suggests ~70% of outcomes fall within the stated bands."
                  />
                  <InterpretGuide
                    title="Uncertainty Bands"
                    desc="80% and 95% confidence intervals derived from walk-forward backtest error distributions. Wider bands indicate higher uncertainty. The 95% band should contain the realized outcome in ~95% of cases when the model is well-calibrated."
                  />
                  <InterpretGuide
                    title="Structural Break Flags"
                    desc="CUSUM test on Holt-smoothing residuals identifies regime changes. When flagged, forecasts carry reduced confidence and elevated risk pressure. Historical continuity assumptions may not hold."
                  />
                  <InterpretGuide
                    title="Momentum"
                    desc="8-period OLS regression slope, significance-filtered at |t| ≥ 1.5. Zero momentum means no statistically detectable trend — not necessarily stability."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="text-xs text-muted-foreground text-center py-4 print:py-8">
              AICIS Governance Framework v1.0 • Generated {new Date().toISOString().split("T")[0]} • 
              Model Version APE-V2.1 • Document is auto-generated from system configuration
            </div>
          </div>
        </ScrollArea>
      </div>
    </AICISLayout>
  );
};

function RiskTier({ level, color, threshold, action }: {
  level: string; color: "destructive" | "default" | "secondary" | "outline"; threshold: string; action: string;
}) {
  return (
    <div className="p-3 rounded-lg border space-y-1">
      <Badge variant={color}>{level}</Badge>
      <p className="text-xs text-muted-foreground">{threshold}</p>
      <p className="text-xs">{action}</p>
    </div>
  );
}

function InterpretGuide({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <p className="font-medium text-sm text-foreground">{title}</p>
      <p className="text-xs">{desc}</p>
    </div>
  );
}

const SOURCES = [
  { name: "World Bank", domain: "Multi", type: "Development indicators" },
  { name: "WHO", domain: "Health", type: "Global health observatory" },
  { name: "FAO/FAOSTAT", domain: "Food", type: "Food security data" },
  { name: "EIA", domain: "Energy", type: "Energy statistics" },
  { name: "OWID", domain: "Multi", type: "Research datasets" },
  { name: "Alpha Vantage", domain: "Finance", type: "Market data" },
  { name: "NVD", domain: "Security", type: "Vulnerability database" },
  { name: "CoinGecko", domain: "Finance", type: "Crypto market data" },
];

export default GovernanceLegal;
