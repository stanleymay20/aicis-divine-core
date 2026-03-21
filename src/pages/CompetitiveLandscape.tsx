import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Target, Shield, Eye, Zap, Globe, CheckCircle2, XCircle, Minus } from "lucide-react";

const COMPETITORS = [
  {
    name: "Dataminr",
    category: "Real-time Event Intelligence",
    strengths: ["100+ US government agencies", "Fortune 100 adoption", "Real-time social signal processing", "Mature enterprise integrations"],
    weaknesses: ["Primarily event-driven, not structural", "Proprietary methodology (black box)", "No public validation metrics", "Limited multi-domain correlation"],
    marketPosition: "Market leader in real-time threat detection",
  },
  {
    name: "Palantir Gotham",
    category: "Operational Decision Platform",
    strengths: ["Deep government relationships", "Flexible data integration", "Battle-tested in defense/intelligence", "Strong ontology mapping"],
    weaknesses: ["Extremely high cost", "Vendor lock-in concerns", "No public methodology", "Requires significant implementation services"],
    marketPosition: "Dominant in defense and intelligence operations",
  },
  {
    name: "Crisis24",
    category: "Risk Intelligence & Security",
    strengths: ["Large-scale operational support", "24/7 analyst coverage", "Travel risk management", "Physical security integration"],
    weaknesses: ["Human-analyst dependent (not AI-native)", "Limited predictive capability", "Primarily reactive intelligence", "No open methodology"],
    marketPosition: "Leading corporate travel and physical security intelligence",
  },
  {
    name: "Recorded Future",
    category: "Threat Intelligence Platform",
    strengths: ["Deep cyber threat intelligence", "Strong analyst workflow tools", "Extensive dark web monitoring", "NLP-powered entity extraction"],
    weaknesses: ["Primarily cyber-focused", "Limited macro/geopolitical depth", "No published validation data", "Narrow domain coverage"],
    marketPosition: "Leader in cyber threat intelligence workflows",
  },
];

type FeatureStatus = "full" | "partial" | "none";

const COMPARISON_MATRIX: { feature: string; aicis: FeatureStatus; dataminr: FeatureStatus; palantir: FeatureStatus; crisis24: FeatureStatus; recorded: FeatureStatus }[] = [
  { feature: "Multi-domain coverage (7+ domains)", aicis: "full", dataminr: "partial", palantir: "partial", crisis24: "partial", recorded: "none" },
  { feature: "211-country coverage", aicis: "full", dataminr: "partial", palantir: "partial", crisis24: "partial", recorded: "partial" },
  { feature: "Published methodology", aicis: "full", dataminr: "none", palantir: "none", crisis24: "none", recorded: "none" },
  { feature: "Live validation metrics", aicis: "full", dataminr: "none", palantir: "none", crisis24: "none", recorded: "none" },
  { feature: "Public data sources only", aicis: "full", dataminr: "none", palantir: "none", crisis24: "partial", recorded: "none" },
  { feature: "Human-in-the-loop governance", aicis: "full", dataminr: "partial", palantir: "full", crisis24: "full", recorded: "partial" },
  { feature: "Real-time event detection", aicis: "partial", dataminr: "full", palantir: "partial", crisis24: "full", recorded: "full" },
  { feature: "Enterprise maturity", aicis: "none", dataminr: "full", palantir: "full", crisis24: "full", recorded: "full" },
  { feature: "Proven predictive advantage", aicis: "partial", dataminr: "partial", palantir: "partial", crisis24: "none", recorded: "partial" },
  { feature: "Village-level granularity", aicis: "full", dataminr: "none", palantir: "partial", crisis24: "none", recorded: "none" },
  { feature: "Forecast auditability (SHA-256)", aicis: "full", dataminr: "none", palantir: "none", crisis24: "none", recorded: "none" },
  { feature: "EU AI Act alignment", aicis: "full", dataminr: "partial", palantir: "partial", crisis24: "partial", recorded: "partial" },
];

const StatusIcon = ({ status }: { status: FeatureStatus }) => {
  if (status === "full") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "partial") return <Minus className="h-4 w-4 text-warning" />;
  return <XCircle className="h-4 w-4 text-destructive/60" />;
};

const CompetitiveLandscape = () => {
  return (
    <AICISLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Competitive Landscape</h1>
            <p className="text-sm text-muted-foreground">
              Honest positioning against established platforms
            </p>
          </div>
        </div>

        {/* Positioning Statement */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">AICIS positioning:</strong> AICIS is not the market leader in this category today. 
              It is one of the most architecturally interesting emerging platforms, differentiated by planetary multi-domain coverage, 
              public-data-first methodology, published validation metrics, and transparent AI-assisted advisory outputs. 
              Enterprise maturity and proven predictive superiority are still being established.
            </p>
          </CardContent>
        </Card>

        {/* Comparison Matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Feature Comparison Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-6 gap-1 text-xs font-medium pb-2 border-b border-border">
                  <div className="col-span-1 text-muted-foreground">Capability</div>
                  <div className="text-center text-primary font-bold">AICIS</div>
                  <div className="text-center">Dataminr</div>
                  <div className="text-center">Palantir</div>
                  <div className="text-center">Crisis24</div>
                  <div className="text-center">Recorded Future</div>
                </div>
                {COMPARISON_MATRIX.map((row) => (
                  <div key={row.feature} className="grid grid-cols-6 gap-1 py-2 border-b border-border/30 items-center text-xs">
                    <div className="col-span-1 text-muted-foreground">{row.feature}</div>
                    <div className="flex justify-center"><StatusIcon status={row.aicis} /></div>
                    <div className="flex justify-center"><StatusIcon status={row.dataminr} /></div>
                    <div className="flex justify-center"><StatusIcon status={row.palantir} /></div>
                    <div className="flex justify-center"><StatusIcon status={row.crisis24} /></div>
                    <div className="flex justify-center"><StatusIcon status={row.recorded} /></div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> Full</span>
              <span className="flex items-center gap-1"><Minus className="h-3 w-3 text-warning" /> Partial</span>
              <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive/60" /> None</span>
            </div>
          </CardContent>
        </Card>

        {/* Competitor Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPETITORS.map((c) => (
            <Card key={c.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{c.marketPosition}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <p className="font-medium text-success mb-1">Strengths</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {c.strengths.map((s) => (
                      <li key={s} className="flex items-start gap-1.5">
                        <Zap className="h-3 w-3 mt-0.5 text-success shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-destructive mb-1">Limitations</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {c.weaknesses.map((w) => (
                      <li key={w} className="flex items-start gap-1.5">
                        <Shield className="h-3 w-3 mt-0.5 text-destructive/60 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AICIS Differentiation */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Where AICIS Is Genuinely Differentiated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DiffCard
                title="Transparency"
                desc="Published methodology, live validation metrics, SHA-256 audit hashes. No other platform in this category publishes its accuracy data in real-time."
              />
              <DiffCard
                title="Coverage Architecture"
                desc="2.57M indicators across 211 countries, 24K+ regions, 7 domains. Multi-domain correlation at planetary scale from a single platform."
              />
              <DiffCard
                title="Public-Data Posture"
                desc="Exclusively uses publicly available institutional data. No proprietary surveillance, no personal data. Defensible for government and NGO adoption."
              />
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground text-center">
              <strong>Honest assessment:</strong> AICIS wins on transparency, coverage architecture, and regulatory posture. 
              It currently loses on enterprise maturity, proven predictive superiority, and market traction. 
              The strategic bet is that transparency + validation will become the industry standard.
            </div>
          </CardContent>
        </Card>
      </div>
    </AICISLayout>
  );
};

function DiffCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
      <p className="font-medium text-primary text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

export default CompetitiveLandscape;
