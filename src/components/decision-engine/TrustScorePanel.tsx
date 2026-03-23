import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Info } from "lucide-react";

interface TrustData {
  model_version: string;
  calibration_error: number | null;
  acceptance_rate: number | null;
  outcome_maturity_ratio: number | null;
  trust_score: number;
  evaluated_at: string;
}

interface Threshold {
  min_samples: number;
  min_measured_samples: number;
  min_acceptances: number;
  enabled: boolean;
}

const trustTiers = [
  { min: 75, label: "Trusted", variant: "default" as const },
  { min: 50, label: "Operational", variant: "secondary" as const },
  { min: 25, label: "Emerging", variant: "outline" as const },
  { min: 0, label: "Experimental", variant: "destructive" as const },
];

function getTrustTier(score: number) {
  return trustTiers.find(t => score >= t.min) || trustTiers[trustTiers.length - 1];
}

function getTrustDrivers(data: TrustData): string[] {
  const drivers: string[] = [];
  if (data.calibration_error != null) drivers.push(`ECE ${data.calibration_error.toFixed(3)}`);
  if (data.acceptance_rate != null) drivers.push(`Accept ${(data.acceptance_rate * 100).toFixed(0)}%`);
  if (data.outcome_maturity_ratio != null) drivers.push(`Maturity ${(data.outcome_maturity_ratio * 100).toFixed(0)}%`);
  return drivers;
}

export default function TrustScorePanel() {
  const { data } = useQuery<TrustData | null>({
    queryKey: ["system-trust-score"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_trust_score" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 120_000,
  });

  const { data: threshold } = useQuery<Threshold | null>({
    queryKey: ["threshold-trust-score"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_metric_thresholds" as any)
        .select("min_samples, min_measured_samples, min_acceptances, enabled")
        .eq("metric_name", "trust_score")
        .maybeSingle();
      return data as any;
    },
    staleTime: 300_000,
  });

  if (!data) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-3 px-4 text-center">
          <ShieldCheck className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Trust score available after first evaluation run.</p>
        </CardContent>
      </Card>
    );
  }

  // Trust score is now fully server-computed via the view
  const displayScore = data.trust_score;
  const tier = getTrustTier(displayScore);
  const drivers = getTrustDrivers(data);
  const color = displayScore >= 70 ? "text-primary" : displayScore >= 40 ? "text-warning" : "text-destructive";

  return (
    <Card className="border-primary/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className={`h-5 w-5 ${color}`} />
          <div>
            <p className="text-xs font-medium text-muted-foreground">System Trust Score</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${color}`}>{displayScore}<span className="text-xs font-normal text-muted-foreground">/100</span></p>
              <Badge variant={tier.variant} className="text-[9px] h-4">{tier.label}</Badge>
              {data.outcome_maturity_ratio != null && data.outcome_maturity_ratio < 0.1 && <AlertTriangle className="h-3.5 w-3.5 text-warning" title="Low measured evidence" />}
            </div>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">ECE</p>
              <p className="text-xs font-mono">{data.calibration_error?.toFixed(3) ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Accept</p>
              <p className="text-xs font-mono">{data.acceptance_rate != null ? `${(data.acceptance_rate * 100).toFixed(0)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Maturity</p>
              <p className="text-xs font-mono">{data.outcome_maturity_ratio != null ? `${(data.outcome_maturity_ratio * 100).toFixed(0)}%` : "—"}</p>
            </div>
          </div>
        </div>
        {drivers.length > 0 && (
          <p className="text-[9px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <Info className="h-2.5 w-2.5 shrink-0" />
            Driven by: {drivers.join(" · ")}
            {belowThreshold && " · Capped: insufficient measured evidence"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
