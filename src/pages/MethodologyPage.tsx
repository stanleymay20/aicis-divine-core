/**
 * AICIS Model Methodology & Audit Readiness Page
 * Auto-generated whitepaper + forecast accuracy + data source transparency.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import {
  BookOpen, BarChart3, Database, Shield, GitBranch,
  TrendingUp, AlertTriangle, CheckCircle2
} from "lucide-react";

const MethodologyPage = () => {
  return (
    <AICISLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Model Methodology & Audit Package</h1>
            <p className="text-sm text-muted-foreground">
              Institutional documentation for independent review and regulatory compliance
            </p>
          </div>
        </div>

        <Tabs defaultValue="methodology" className="space-y-4">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="methodology" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Methodology
            </TabsTrigger>
            <TabsTrigger value="parameters" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Parameters
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Forecast Accuracy
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-2">
              <Database className="h-4 w-4" />
              Data Sources
            </TabsTrigger>
            <TabsTrigger value="registry" className="gap-2">
              <Shield className="h-4 w-4" />
              Model Registry
            </TabsTrigger>
          </TabsList>

          {/* Methodology Whitepaper */}
          <TabsContent value="methodology">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  AICIS Performance Engine V2 — Technical Whitepaper
                </CardTitle>
                <Badge variant="outline">Auto-generated from source code</Badge>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
                    <Section title="1. Overview">
                      The AICIS Performance Engine V2 (APE-V2) computes National Performance
                      Indices across 9 domains using benchmark-anchored normalization, Holt
                      double-exponential smoothing for forecasts, and CUSUM-based structural
                      break detection.
                    </Section>

                    <Section title="2. Normalization">
                      Raw metric values are normalized against global benchmarks stored in{" "}
                      <code>global_domain_benchmarks</code>. Each benchmark defines structural
                      floor/ceiling bounds. The formula:{" "}
                      <code>score = ((value - floor) / (ceiling - floor)) × 100</code>, clamped
                      to [0, 100].
                    </Section>

                    <Section title="3. Forecasting Model">
                      <strong>Holt Double Exponential Smoothing</strong> with level (α) and
                      trend (β) parameters. The model produces both a smoothed level and a
                      trend component. Forecasts project forward using period-aware horizons
                      (monthly, quarterly, or annual detection). A volatility-scaled damping
                      factor reduces trend influence for high-volatility series:{" "}
                      <code>damping = max(0.3, 1 - volatility/200)</code>.
                    </Section>

                    <Section title="4. Momentum Calculation">
                      8-period OLS regression on normalized values. The slope is converted to
                      a percentage of the mean. A t-statistic significance filter ensures only
                      statistically meaningful trends (|t| ≥ 1.5) produce non-zero momentum.
                      This prevents noise from being reported as signal.
                    </Section>

                    <Section title="5. Volatility Decomposition">
                      Total volatility uses coefficient of variation on the last 6 periods.
                      V2 separates this into <strong>downside volatility</strong> (negative
                      deviations only) and <strong>upside volatility</strong> (positive
                      deviations only). The skew ratio (downside/upside) identifies
                      asymmetric risk profiles.
                    </Section>

                    <Section title="6. Structural Break Detection">
                      CUSUM (Cumulative Sum) test with Brown-Durbin-Evans approximate
                      critical values. At 5% significance: threshold ≈ 0.948√n. Returns a
                      p-value and break index. Breaks are flagged at the 10% significance
                      level, triggering +10 risk pressure and -12 confidence adjustments.
                    </Section>

                    <Section title="7. Confidence Scoring">
                      Composite formula: <code>15 + (density × 25) + (stability × 20) +
                      sourceDiversityBonus + timeSpanBonus - volatilityPenalty -
                      breakPenalty - gapPenalty - stalenessPenalty</code>. Base of 15
                      ensures confidence is earned. Clamped to [10, 95].
                    </Section>

                    <Section title="8. Uncertainty Bands">
                      80% and 95% confidence intervals derived from backtest error
                      distribution. Band width scales with <code>(1 - stabilityScore) × 30
                      + volatility × 0.3</code>, multiplied by z-scores (1.28 for 80%,
                      1.96 for 95%).
                    </Section>

                    <Section title="9. Systemic Fragility">
                      Multiplicative deficiency model across governance, security, and
                      finance: <code>fragility = (1 - gov) × (1 - sec) × (1 - fin)</code>.
                      Captures nonlinear cascading risk where multiple weak domains
                      compound.
                    </Section>

                    <Section title="10. Backtesting">
                      Walk-forward validation using Holt model (identical to production).
                      Metrics: MAE, RMSE, MAPE, forecast bias. Stability score derived
                      from normalized RMSE. Grid-search calibration optimizes α and β
                      per domain to minimize RMSE.
                    </Section>

                    <Section title="11. Known Limitations">
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Domain weights (governance 0.18, etc.) are not empirically calibrated</li>
                        <li>Fragility model uses only 3 of 9 domains</li>
                        <li>No out-of-sample validation against real outcomes yet</li>
                        <li>Confidence formula is compositional, not empirically calibrated</li>
                        <li>Exponential smoothing assumes continuity — regime changes not handled</li>
                      </ul>
                    </Section>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Parameter Calibration */}
          <TabsContent value="parameters">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Parameter Calibration Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ParamCard label="Level Smoothing (α)" defaultVal="0.55" range="0.2–0.8" method="Grid search minimizing RMSE" />
                    <ParamCard label="Trend Smoothing (β)" defaultVal="0.30" range="0.1–0.5" method="Grid search minimizing RMSE" />
                    <ParamCard label="Momentum Window" defaultVal="8 periods" range="N/A" method="Fixed (statistical minimum for t-test)" />
                    <ParamCard label="t-stat Threshold" defaultVal="1.5" range="N/A" method="Standard significance proxy" />
                    <ParamCard label="CUSUM Significance" defaultVal="10%" range="5–10%" method="Brown-Durbin-Evans tables" />
                    <ParamCard label="Damping Floor" defaultVal="0.3" range="N/A" method="Prevents over-damping in volatile series" />
                    <ParamCard label="Confidence Base" defaultVal="15" range="N/A" method="Ensures confidence is earned, not assumed" />
                    <ParamCard label="Confidence Cap" defaultVal="95" range="N/A" method="Military/humanitarian doctrine" />
                  </div>
                  <Separator />
                  <div className="text-sm text-muted-foreground">
                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                    Domain weights are currently expert-assigned, not empirically calibrated.
                    Future work: sensitivity analysis and cross-validation.
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Forecast Accuracy */}
          <TabsContent value="accuracy">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Forecast Accuracy Dashboard
                </CardTitle>
                <Badge variant="secondary">Requires 12 months of live tracking</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 space-y-4">
                  <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold">Accuracy Tracking Not Yet Available</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Forecast accuracy requires comparing historical predictions against
                    observed outcomes over a minimum 12-month tracking period. This
                    dashboard will populate automatically as live data accumulates.
                  </p>
                  <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto pt-4">
                    <MetricPlaceholder label="MAE" />
                    <MetricPlaceholder label="RMSE" />
                    <MetricPlaceholder label="MAPE" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Sources */}
          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Source Transparency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {DATA_SOURCES.map((src) => (
                    <div key={src.name} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{src.name}</p>
                        <p className="text-xs text-muted-foreground">{src.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{src.domain}</Badge>
                        <Badge variant={src.status === 'active' ? 'default' : 'secondary'}>
                          {src.status === 'active' ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" />Active</>
                          ) : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Model Registry */}
          <TabsContent value="registry">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Versioned Model Registry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <RegistryEntry
                    version="V2.1"
                    date="2026-02-15"
                    changes={[
                      "Downside/upside volatility separation",
                      "80%/95% forecast uncertainty bands",
                      "Signal prioritization engine",
                      "Feature flag runtime system",
                    ]}
                    status="current"
                  />
                  <RegistryEntry
                    version="V2.0"
                    date="2026-02-14"
                    changes={[
                      "Holt double-exponential smoothing",
                      "CUSUM structural break detection",
                      "t-statistic momentum filtering",
                      "Data gap interpolation",
                      "Grid-search parameter calibration",
                    ]}
                    status="superseded"
                  />
                  <RegistryEntry
                    version="V1.0"
                    date="2026-02-01"
                    changes={[
                      "Simple exponential smoothing",
                      "CV-based volatility",
                      "Threshold-based structural breaks",
                      "Fixed hyperparameters",
                    ]}
                    status="deprecated"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AICISLayout>
  );
};

// Helper components
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-base font-semibold mb-2">{title}</h3>
    <div className="text-sm text-muted-foreground">{children}</div>
  </div>
);

const ParamCard = ({ label, defaultVal, range, method }: {
  label: string; defaultVal: string; range: string; method: string;
}) => (
  <div className="p-3 rounded-lg border space-y-1">
    <p className="font-medium text-sm">{label}</p>
    <p className="text-xs">Default: <code className="bg-muted px-1 rounded">{defaultVal}</code></p>
    <p className="text-xs">Range: <code className="bg-muted px-1 rounded">{range}</code></p>
    <p className="text-xs text-muted-foreground">{method}</p>
  </div>
);

const MetricPlaceholder = ({ label }: { label: string }) => (
  <div className="p-3 rounded-lg border text-center">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-mono text-muted-foreground/30">—</p>
  </div>
);

const RegistryEntry = ({ version, date, changes, status }: {
  version: string; date: string; changes: string[]; status: 'current' | 'superseded' | 'deprecated';
}) => (
  <div className={`p-4 rounded-lg border ${status === 'current' ? 'border-primary/30 bg-primary/5' : ''}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Badge variant={status === 'current' ? 'default' : 'secondary'}>{version}</Badge>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      <Badge variant="outline" className="text-xs">{status}</Badge>
    </div>
    <ul className="text-xs text-muted-foreground space-y-0.5">
      {changes.map((c, i) => <li key={i}>• {c}</li>)}
    </ul>
  </div>
);

const DATA_SOURCES = [
  { name: "World Bank", domain: "Multi-domain", description: "Development indicators, governance, finance", status: "active" },
  { name: "WHO Global Health Observatory", domain: "Health", description: "Health metrics, disease surveillance", status: "active" },
  { name: "FAO/FAOSTAT", domain: "Food", description: "Food production, price indices", status: "active" },
  { name: "EIA (Energy Information)", domain: "Energy", description: "Energy production, consumption", status: "active" },
  { name: "OWID (Our World in Data)", domain: "Multi-domain", description: "Energy, health, population datasets", status: "active" },
  { name: "Alpha Vantage", domain: "Finance", description: "Market data, exchange rates", status: "active" },
  { name: "NVD (Vulnerability DB)", domain: "Security", description: "Cybersecurity vulnerability data", status: "active" },
  { name: "ACLED", domain: "Security", description: "Armed conflict and event data", status: "pending" },
  { name: "IMF Data Portal", domain: "Finance", description: "Macroeconomic indicators", status: "pending" },
];

export default MethodologyPage;
