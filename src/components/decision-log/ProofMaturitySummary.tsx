import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, FlaskConical, BarChart3, TrendingUp } from "lucide-react";

interface ProofMaturitySummaryProps {
  hypothetical: number;
  pilot: number;
  measured: number;
}

const ProofMaturitySummary = ({ hypothetical, pilot, measured }: ProofMaturitySummaryProps) => {
  const total = hypothetical + pilot + measured;
  const maturityPct = total > 0 ? Math.round(((pilot * 2 + measured * 5) / (total * 5)) * 100) : 0;

  return (
    <Card className="border-accent/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-accent-foreground" />
            Proof Maturity
          </p>
          <span className="text-xs font-bold text-primary">{maturityPct}%</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <Lightbulb className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{hypothetical}</p>
            <p className="text-[9px] text-muted-foreground">Hypothetical</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/10">
            <FlaskConical className="h-3.5 w-3.5 mx-auto text-accent-foreground mb-1" />
            <p className="text-lg font-bold">{pilot}</p>
            <p className="text-[9px] text-muted-foreground">Pilot</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <BarChart3 className="h-3.5 w-3.5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{measured}</p>
            <p className="text-[9px] text-muted-foreground">Measured</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProofMaturitySummary;
