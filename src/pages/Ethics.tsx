import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Globe, 
  Users, 
  FileText, 
  CheckCircle,
  XCircle,
  Download,
  ExternalLink
} from "lucide-react";
import aicisLogo from "@/assets/aicis-logo.png";

/**
 * AICIS Ethics & Non-Surveillance Guarantee
 * Machine-readable ethics manifest available at /ethics.json
 */

interface EthicsItem {
  title: string;
  description: string;
  status: "guaranteed" | "prohibited";
}

const WHAT_AICIS_DOES: EthicsItem[] = [
  {
    title: "Aggregated Public Data",
    description: "Uses only publicly accessible, institutional-level datasets from organizations like WHO, World Bank, FAO, and governmental sources.",
    status: "guaranteed",
  },
  {
    title: "Anonymized Signals",
    description: "All data is aggregated at population, regional, or national levels. Individual records are never processed.",
    status: "guaranteed",
  },
  {
    title: "Transparent Sources",
    description: "Every intelligence output includes full data provenance with source attribution and timestamps.",
    status: "guaranteed",
  },
  {
    title: "Confidence Bands",
    description: "All predictions include uncertainty ranges. AICIS never claims certainty and caps confidence at 95%.",
    status: "guaranteed",
  },
  {
    title: "Human Decision Authority",
    description: "AICIS provides intelligence and recommendations. All decisions remain with human operators.",
    status: "guaranteed",
  },
  {
    title: "Open Methodology",
    description: "Algorithms, data sources, and decision frameworks are documented and auditable.",
    status: "guaranteed",
  },
];

const WHAT_AICIS_DOES_NOT: EthicsItem[] = [
  {
    title: "Personal Data Collection",
    description: "AICIS does not collect, store, or process any personally identifiable information (PII).",
    status: "prohibited",
  },
  {
    title: "Facial Recognition",
    description: "No facial recognition, biometric scanning, or individual identification capabilities.",
    status: "prohibited",
  },
  {
    title: "Individual Tracking",
    description: "No tracking of individual movements, communications, or behaviors.",
    status: "prohibited",
  },
  {
    title: "Social Media Surveillance",
    description: "No scraping or analysis of individual social media accounts or private communications.",
    status: "prohibited",
  },
  {
    title: "Predictive Policing",
    description: "No individual risk scoring or predictive targeting of specific persons.",
    status: "prohibited",
  },
  {
    title: "Autonomous Actions",
    description: "AICIS does not take autonomous actions. It only provides intelligence for human decision-making.",
    status: "prohibited",
  },
];

const DATA_SOURCES = [
  { name: "World Bank", type: "Government/IGO", coverage: "Global economic & development" },
  { name: "WHO", type: "Government/IGO", coverage: "Global health" },
  { name: "FAO/WFP", type: "Government/IGO", coverage: "Food security" },
  { name: "NASA EONET", type: "Government", coverage: "Natural events" },
  { name: "USGS", type: "Government", coverage: "Seismic & geological" },
  { name: "GDELT", type: "Academic/Aggregator", coverage: "News & events" },
  { name: "OWID", type: "Academic", coverage: "Cross-domain research" },
  { name: "GDACS", type: "Government/IGO", coverage: "Disaster alerts" },
];

export default function Ethics() {
  const handleDownloadManifest = () => {
    const manifest = {
      "@context": "https://schema.org",
      "@type": "EthicsPolicy",
      name: "AICIS Ethics Manifest",
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      organization: "AICIS Global Intelligence",
      guarantees: WHAT_AICIS_DOES.map(item => ({
        principle: item.title,
        description: item.description,
        type: "guaranteed"
      })),
      prohibitions: WHAT_AICIS_DOES_NOT.map(item => ({
        principle: item.title,
        description: item.description,
        type: "prohibited"
      })),
      dataSources: DATA_SOURCES,
      complianceFrameworks: ["GDPR", "AI Ethics Guidelines (EU)", "UN AI Principles"],
      contact: "ethics@aicis.global"
    };
    
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aicis-ethics-manifest.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={aicisLogo} alt="AICIS" className="h-10 w-10" />
            <div>
              <h1 className="font-orbitron font-bold text-lg">AICIS Ethics</h1>
              <p className="text-xs text-muted-foreground">Non-Surveillance Guarantee</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadManifest}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download Manifest
          </Button>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/30">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-orbitron font-bold">
            AICIS Data Ethics Charter
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            AICIS is built on the principle that global intelligence can serve humanity 
            without compromising individual privacy. This charter defines our commitment 
            to ethical data use and non-surveillance operation.
          </p>
          <div className="flex items-center justify-center gap-2 pt-4">
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              GDPR Compliant
            </Badge>
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              EU AI Ethics Aligned
            </Badge>
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              UN AI Principles
            </Badge>
          </div>
        </div>

        <Separator />

        {/* What AICIS Does */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-success" />
            <h3 className="text-xl font-semibold">What AICIS Does</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {WHAT_AICIS_DOES.map((item, i) => (
              <Card key={i} className="border-success/20">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* What AICIS Does NOT Do */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-destructive" />
            <h3 className="text-xl font-semibold">What AICIS Does NOT Do</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {WHAT_AICIS_DOES_NOT.map((item, i) => (
              <Card key={i} className="border-destructive/20 bg-destructive/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* Data Sources */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold">Data Sources</h3>
          </div>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                AICIS exclusively uses publicly accessible, institutional data sources. 
                All data is aggregated at population or regional level.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {DATA_SOURCES.map((source, i) => (
                  <div 
                    key={i}
                    className="p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="font-medium text-sm">{source.name}</div>
                    <div className="text-xs text-muted-foreground">{source.type}</div>
                    <div className="text-[10px] text-primary mt-1">{source.coverage}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Federated Node Architecture */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold">Sovereign Participation</h3>
          </div>
          <Card>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                AICIS operates on a federated architecture where participation is voluntary 
                and sovereignty is preserved.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <Badge className="mb-2">Observer Node</Badge>
                  <p className="text-sm text-muted-foreground">
                    Read-only access to global intelligence without contributing data.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <Badge className="mb-2">Contributor Node</Badge>
                  <p className="text-sm text-muted-foreground">
                    Add national datasets to enhance global picture. Full data control retained.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <Badge className="mb-2">Sovereign Node</Badge>
                  <p className="text-sm text-muted-foreground">
                    Internal use only with aggregated outputs shared. Maximum sovereignty.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Accountability */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold">Accountability & Compliance</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Every intelligence output logs: data sources, model version, confidence score, 
                and timestamp. Exportable as PDF/JSON for legal and regulatory compliance.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Machine-Readable Manifest
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Download our ethics manifest in JSON-LD format for automated compliance 
                verification and integration with governance systems.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>
            Questions about our ethics practices?{" "}
            <a href="mailto:ethics@aicis.global" className="text-primary hover:underline">
              Contact our Ethics Board
            </a>
          </p>
          <p className="mt-2">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </main>
    </div>
  );
}
