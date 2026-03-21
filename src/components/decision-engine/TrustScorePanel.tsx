import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

interface TrustData {
  model_version: string;
  calibration_error: number | null;
  acceptance_rate: number | null;
  outcome_maturity_ratio: number | null;
  trust_score: number;
  evaluated_at: string;
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

  const score = data.trust_score;
  const color = score >= 70 ? "text-primary" : score >= 40 ? "text-warning" : "text-destructive";

  return (
    <Card className="border-primary/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className={`h-5 w-5 ${color}`} />
          <div>
            <p className="text-xs font-medium text-muted-foreground">System Trust Score</p>
            <p className={`text-2xl font-bold ${color}`}>{score}<span className="text-xs font-normal text-muted-foreground">/100</span></p>
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
      </CardContent>
    </Card>
  );
}
