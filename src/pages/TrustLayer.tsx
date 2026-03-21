import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Eye, Scale, Lock, Database, Brain, Users,
  FileCheck, AlertTriangle, CheckCircle, ExternalLink,
  Loader2, Globe, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TrustLayer = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Live trust metrics
  const { data: trustStats, isLoading } = useQuery({
    queryKey: ["trust-layer-stats"],
    queryFn: async () => {
      const [
        { count: totalValidations },
        { count: totalCountries },
        { data: latestScore },
        { count: totalDecisions },
        { count: auditEntries },
      ] = await Promise.all([
        supabase.from("forecast_validation_results").select("*", { count: "exact", head: true }),
        supabase.from("country_performance_snapshots").select("iso3", { count: "exact", head: true }),
        supabase.from("intelligence_score_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1),
        supabase.from("adi_decisions").select("*", { count: "exact", head: true }),
        supabase.from("automation_logs").select("*", { count: "exact", head: true }),
      ]);

      return {
        totalValidations: totalValidations || 0,
        totalCountries: totalCountries || 0,
        intelligenceGrade: latestScore?.[0]?.intelligence_grade || "SENSING",
        turningPointAccuracy: latestScore?.[0]?.turning_point_accuracy || 0,
        totalDecisions: totalDecisions || 0,
        auditEntries: auditEntries || 0,
      };
    },
    enabled: !!user,
  });

  if (authLoading || !user) return null;

  return (
    <AICISLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-orbitron font-bold text-foreground flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            Trust &amp; Transparency Layer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            How AICIS earns and maintains institutional trust — with evidence, not claims
          </p>
        </div>

        {/* Core Principle */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <p className="text-sm text-foreground leading-relaxed">
              <strong>Trust Principle:</strong> AICIS is designed so it <em>cannot hide its errors</em>, rather than claiming 
              it never makes them. Every forecast is validated against reality. Every AI output is labeled as advisory. 
              Every decision passes through human oversight. The system proves its value through transparent, 
              falsifiable evidence — not marketing claims.
            </p>
          </CardContent>
        </Card>

        {/* Live Evidence Cards */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <EvidenceCard
              icon={<Activity className="h-5 w-5 text-primary" />}
              label="Forecast Validations"
              value={(trustStats?.totalValidations || 0).toLocaleString()}
              detail="Predictions checked against reality"
            />
            <EvidenceCard
              icon={<Globe className="h-5 w-5 text-primary" />}
              label="Countries Tracked"
              value={(trustStats?.totalCountries || 0).toLocaleString()}
              detail="Multi-domain performance snapshots"
            />
            <EvidenceCard
              icon={<Brain className="h-5 w-5 text-primary" />}
              label="Intelligence Grade"
              value={trustStats?.intelligenceGrade || "—"}
              detail={`${trustStats?.turningPointAccuracy || 0}% turning-point accuracy`}
            />
            <EvidenceCard
              icon={<Users className="h-5 w-5 text-primary" />}
              label="ADI Decisions"
              value={(trustStats?.totalDecisions || 0).toString()}
              detail="Human-reviewed recommendations"
            />
            <EvidenceCard
              icon={<Database className="h-5 w-5 text-primary" />}
              label="Audit Log Entries"
              value={(trustStats?.auditEntries || 0).toLocaleString()}
              detail="Immutable pipeline records"
            />
            <EvidenceCard
              icon={<CheckCircle className="h-5 w-5 text-primary" />}
              label="System Mode"
              value="Advisory"
              detail="All outputs require human review"
            />
          </div>
        )}

        {/* Trust Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TrustPillar
            icon={<Eye className="h-5 w-5" />}
            title="Transparency"
            items={[
              "All data sources are publicly identified and attributed",
              "AI model methodology is published and versioned",
              "Confidence scores and uncertainty bands accompany every output",
              "Forecast accuracy is continuously measured and displayed",
              "Residual datasets are available for independent audit",
            ]}
          />
          <TrustPillar
            icon={<Scale className="h-5 w-5" />}
            title="Accountability"
            items={[
              "Human-in-the-loop governance for all actionable outputs",
              "Immutable Decision Ledger with reviewer identity and timestamps",
              "No autonomous action — system operates in advisory mode",
              "Ethics review process for contested assessments",
              "Role-based access control with audit trails",
            ]}
          />
          <TrustPillar
            icon={<Lock className="h-5 w-5" />}
            title="Security"
            items={[
              "Row-level security (RLS) on all database tables",
              "Encrypted data at rest and in transit",
              "Rate limiting and IP access controls",
              "GDPR-compliant data handling with deletion support",
              "Regular dependency scanning and security audits",
            ]}
          />
          <TrustPillar
            icon={<FileCheck className="h-5 w-5" />}
            title="Falsifiability"
            items={[
              "Every forecast is testable against future reality",
              "Directional accuracy is measured daily against naive baselines",
              "Calibration metrics (MAE, RMSE, MAPE) are computed continuously",
              "SHA-256 hashing of calibration datasets for cryptographic integrity",
              "The system explicitly shows when its predictions are wrong",
            ]}
          />
        </div>

        {/* AI Disclaimer */}
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              AI Advisory Disclaimer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              AICIS outputs are <strong>AI-assisted analytical signals</strong> generated from publicly available data sources. 
              They are not validated intelligence, guaranteed predictions, or instructions for autonomous action.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">⚠️</span>
                Forecasts are probabilistic estimates with associated uncertainty — they may be inaccurate
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">⚠️</span>
                Conflict risk assessments are AI-synthesized hypotheses for human review, not field intelligence
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">⚠️</span>
                No output should be used as the sole basis for policy, investment, or humanitarian decisions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning mt-0.5">⚠️</span>
                Independent verification from primary sources is always recommended
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Regulatory Compliance */}
        <Card className="border-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Regulatory Alignment</CardTitle>
            <CardDescription className="text-xs">Standards AICIS is designed to meet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ComplianceBadge
                label="EU AI Act"
                status="Aligned"
                detail="Decision-support system with mandatory human oversight"
              />
              <ComplianceBadge
                label="GDPR"
                status="Compliant"
                detail="No personal data in analytical layer; user data rights enforced"
              />
              <ComplianceBadge
                label="ISO 27001 Principles"
                status="Applied"
                detail="Information security management practices implemented"
              />
            </div>
          </CardContent>
        </Card>

        {/* Navigation Links */}
        <div className="flex flex-wrap gap-3">
          <Link to="/privacy">
            <Button variant="outline" size="sm" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Privacy Policy
            </Button>
          </Link>
          <Link to="/terms">
            <Button variant="outline" size="sm" className="text-xs">
              <Scale className="h-3 w-3 mr-1" />
              Terms of Service
            </Button>
          </Link>
          <Link to="/methodology">
            <Button variant="outline" size="sm" className="text-xs">
              <FileCheck className="h-3 w-3 mr-1" />
              Methodology
            </Button>
          </Link>
          <Link to="/prediction-accuracy">
            <Button variant="outline" size="sm" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Prediction Accuracy
            </Button>
          </Link>
          <Link to="/ethics">
            <Button variant="outline" size="sm" className="text-xs">
              <Scale className="h-3 w-3 mr-1" />
              AI Ethics
            </Button>
          </Link>
        </div>
      </div>
    </AICISLayout>
  );
};

// Sub-components

const EvidenceCard = ({ icon, label, value, detail }: {
  icon: React.ReactNode; label: string; value: string; detail: string;
}) => (
  <Card className="border-primary/10">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-orbitron font-bold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{detail}</div>
    </CardContent>
  </Card>
);

const TrustPillar = ({ icon, title, items }: {
  icon: React.ReactNode; title: string; items: string[];
}) => (
  <Card className="border-primary/10">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-orbitron flex items-center gap-2">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
            <CheckCircle className="h-3 w-3 text-primary shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

const ComplianceBadge = ({ label, status, detail }: {
  label: string; status: string; detail: string;
}) => (
  <div className="rounded-lg border border-primary/10 p-3">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
        {status}
      </Badge>
    </div>
    <p className="text-[10px] text-muted-foreground">{detail}</p>
  </div>
);

export default TrustLayer;
