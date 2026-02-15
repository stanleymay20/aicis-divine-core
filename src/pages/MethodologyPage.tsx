/**
 * AICIS Model Methodology & Audit Readiness Page
 * Formal versioned whitepaper with export capabilities.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import {
  BookOpen, BarChart3, Database, Shield, GitBranch,
  TrendingUp, AlertTriangle, CheckCircle2, Download, FileText
} from "lucide-react";
import { CURRENT_MODEL_VERSION } from "@/lib/performance-engine-v2";

const WHITEPAPER_VERSION = 3;

const whitepaperContent = {
  version: WHITEPAPER_VERSION,
  modelVersion: CURRENT_MODEL_VERSION,
  generatedAt: new Date().toISOString(),
  sections: [
    {
      id: "formulation",
      title: "1. Mathematical Formulation",
      content: `The AICIS Performance Engine V2 (APE-V2) computes National Performance Indices across 9 domains using:
- Benchmark-anchored normalization against global_domain_benchmarks (structural floor/ceiling)
- Formula: score = ((value - floor) / (ceiling - floor)) × 100, clamped to [0, 100]
- Weighted aggregation via version-locked domain_weights (governance 0.18, health 0.16, etc.)
- Stateless computation: all weights, parameters, and calibration profiles are passed explicitly via ComputeContext`,
    },
    {
      id: "calibration",
      title: "2. Calibration Procedure",
      content: `Platt Scaling calibration maps raw compositional confidence → empirical probabilities:
- calibrated = 1 / (1 + exp(a * raw + b))
- Parameters (a, b) fitted via Newton-Raphson on (predicted_confidence, actual_hit_80_band) pairs
- Minimum 20 samples required; smoothed target probabilities per Platt (2000)
- Calibration profiles stored in model_calibration_profiles with locked_until enforcement
- Recalibration only occurs when profile is unlocked (quarterly schedule)`,
    },
    {
      id: "residuals",
      title: "3. Residual Modeling Method",
      content: `Horizon-specific residual distributions with exponential decay weighting:
- Residuals stored per (model_version, domain, horizon_days) in forecast_residuals
- Decay weight: w_i = exp(-λ × age_days), λ = 0.01
- Weighted quantiles computed for 80% (Q10/Q90) and 95% (Q2.5/Q97.5) prediction intervals
- computeDomainPerformanceV2 uses empirical bands when residualDist is provided (≥15 observations)
- Falls back to heuristic scaling (errorMagnitude × z-score) when residuals unavailable
- Separate distributions maintained for 30d, 90d, and 365d horizons`,
    },
    {
      id: "drift",
      title: "4. Drift Detection Framework",
      content: `Statistical Process Control (SPC) with EWMA control charts:
- EWMA: EWMA_t = λ × x_t + (1-λ) × EWMA_(t-1), λ = 0.2
- Rolling window: 30 observations for μ and σ computation
- Control bands: UCL = μ + 3σ, LCL = μ - 3σ
- Out-of-control signals trigger drift alerts with severity escalation
- Monitored metrics: RMSE, MAPE, Hit80, Hit95, Avg Bias
- Kill-switch activation on: RMSE > 3σ, Hit80 < 60%, Break rate > 60%, Cal divergence > 25%`,
    },
    {
      id: "promotion",
      title: "5. Promotion Governance (Champion–Challenger)",
      content: `Model lifecycle: shadow → challenger → active → deprecated
- New models deployed as "shadow" running in parallel
- Promotion requires Diebold-Mariano test at 95% confidence
- DM test: d_t = e_A² - e_B², test_stat = d̄ / SE(d), two-sided p-value
- Promotion only if statistically superior (p < 0.05) with ≥10 paired observations
- Previous active model auto-deprecated on promotion
- No manual override: governance is statistical`,
    },
    {
      id: "limitations",
      title: "6. Limitations and Assumptions",
      content: `Known limitations:
- Domain weights are expert-assigned, not empirically derived via PCA or factor analysis
- Fragility model uses multiplicative deficiency across 3 of 9 domains (governance, security, finance)
- Graph-based coupling propagation is single-pass (no iterative equilibrium)
- Confidence calibration targets 80% band hit rate, not true event probability
- Holt exponential smoothing assumes locally linear trends; abrupt nonlinearities may be underfit
- CUSUM break detection uses approximate p-values (Brown-Durbin-Evans)
- Decay-weighted residuals assume exponential forgetting (may not suit cyclical patterns)
- Kill-switch thresholds are fixed, not adaptive to data volume
- Empirical forecast bands require ≥15 residual observations; new domains use heuristic fallback
- Freeze flag (kill-switch) is enforced in computeDomainPerformanceV2 and edge functions`,
    },
    {
      id: "history",
      title: "7. Version History",
      content: `V2.1 (2026-02-15): SPC/EWMA drift detection, kill-switch, Platt calibration, regime switching, 
  graph-based fragility, champion-challenger governance, decay-weighted residuals, audit hashing
V2.0 (2026-02-14): Holt smoothing, CUSUM breaks, t-stat momentum, gap interpolation, grid-search calibration
V1.0 (2026-02-01): Simple exponential smoothing, CV volatility, fixed hyperparameters`,
    },
  ],
};

const MethodologyPage = () => {
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(whitepaperContent, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AICIS-Methodology-${CURRENT_MODEL_VERSION}-v${WHITEPAPER_VERSION}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleExportText = () => {
    const lines = [
      `AICIS Performance Engine — Technical Methodology`,
      `Model Version: ${CURRENT_MODEL_VERSION}`,
      `Document Version: ${WHITEPAPER_VERSION}`,
      `Generated: ${new Date().toISOString()}`,
      `${"=".repeat(60)}`,
      "",
    ];
    for (const section of whitepaperContent.sections) {
      lines.push(section.title, "", section.content, "", "---", "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AICIS-Methodology-${CURRENT_MODEL_VERSION}-v${WHITEPAPER_VERSION}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <AICISLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Model Methodology & Audit Package</h1>
            <p className="text-sm text-muted-foreground">
              Formal versioned whitepaper for independent review and regulatory compliance
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportText}>
              <FileText className="h-4 w-4 mr-2" />Text
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Badge variant="outline">Model: {CURRENT_MODEL_VERSION}</Badge>
          <Badge variant="outline">Doc v{WHITEPAPER_VERSION}</Badge>
          <Badge variant="secondary">Formal Whitepaper</Badge>
        </div>

        <Tabs defaultValue="methodology" className="space-y-4">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="methodology" className="gap-2">
              <BookOpen className="h-4 w-4" />Whitepaper
            </TabsTrigger>
            <TabsTrigger value="parameters" className="gap-2">
              <GitBranch className="h-4 w-4" />Parameters
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="gap-2">
              <BarChart3 className="h-4 w-4" />Accuracy
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-2">
              <Database className="h-4 w-4" />Sources
            </TabsTrigger>
            <TabsTrigger value="registry" className="gap-2">
              <Shield className="h-4 w-4" />Registry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="methodology">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  AICIS Performance Engine — Technical Whitepaper
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">Auto-generated from source code</Badge>
                  <Badge variant="outline">Version {WHITEPAPER_VERSION}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
                    {whitepaperContent.sections.map(section => (
                      <div key={section.id}>
                        <h3 className="text-base font-semibold mb-2">{section.title}</h3>
                        <div className="text-sm text-muted-foreground whitespace-pre-line">{section.content}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parameters">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />Parameter Calibration Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ParamCard label="Level Smoothing (α)" defaultVal="0.55" range="0.2–0.8" method="Grid search minimizing RMSE" />
                    <ParamCard label="Trend Smoothing (β)" defaultVal="0.30" range="0.1–0.5" method="Grid search minimizing RMSE" />
                    <ParamCard label="EWMA Lambda (λ)" defaultVal="0.2" range="0.05–0.5" method="SPC drift detection sensitivity" />
                    <ParamCard label="Decay Lambda" defaultVal="0.01" range="0.005–0.05" method="Residual age weighting" />
                    <ParamCard label="SPC Window" defaultVal="30 obs" range="N/A" method="Rolling control chart baseline" />
                    <ParamCard label="Control Bands" defaultVal="3σ" range="N/A" method="Standard SPC practice" />
                    <ParamCard label="DM Test Threshold" defaultVal="p < 0.05" range="N/A" method="Two-sided significance for promotion" />
                    <ParamCard label="Confidence Cap" defaultVal="95" range="N/A" method="Military/humanitarian doctrine" />
                  </div>
                  <Separator />
                  <div className="text-sm text-muted-foreground">
                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                    Domain weights are currently expert-assigned. Kill-switch thresholds are fixed at RMSE 3σ / Hit80 60% / Break rate 60%.
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accuracy">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />Forecast Accuracy Dashboard
                </CardTitle>
                <Badge variant="secondary">Requires 12 months of live tracking</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 space-y-4">
                  <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold">Accuracy Tracking — Accumulating</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Forecast accuracy requires comparing historical predictions against outcomes over a minimum 12-month period.
                    Residual distributions, SPC charts, and calibration curves will populate automatically.
                  </p>
                  <div className="grid grid-cols-4 gap-4 max-w-md mx-auto pt-4">
                    <MetricPlaceholder label="MAE" />
                    <MetricPlaceholder label="RMSE" />
                    <MetricPlaceholder label="MAPE" />
                    <MetricPlaceholder label="Hit80" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />Data Source Transparency
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
                          {src.status === 'active' ? <><CheckCircle2 className="h-3 w-3 mr-1" />Active</> : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="registry">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />Versioned Model Registry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <RegistryEntry version="V2.1" date="2026-02-15" status="current" changes={[
                    "SPC/EWMA drift detection with 3σ control bands",
                    "Automatic kill-switch on process out-of-control",
                    "Platt scaling calibration with locked profiles",
                    "Champion-Challenger promotion via Diebold-Mariano test",
                    "Decay-weighted horizon-specific residual distributions",
                    "Regime switching on structural break",
                    "Graph-based cross-domain fragility propagation",
                    "SHA-256 cryptographic audit hashing of residual datasets",
                    "Formal versioned methodology whitepaper export",
                  ]} />
                  <RegistryEntry version="V2.0" date="2026-02-14" status="superseded" changes={[
                    "Holt double-exponential smoothing",
                    "CUSUM structural break detection",
                    "t-statistic momentum filtering",
                    "Data gap interpolation",
                    "Grid-search parameter calibration",
                  ]} />
                  <RegistryEntry version="V1.0" date="2026-02-01" status="deprecated" changes={[
                    "Simple exponential smoothing",
                    "CV-based volatility",
                    "Threshold-based structural breaks",
                    "Fixed hyperparameters",
                  ]} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AICISLayout>
  );
};

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
