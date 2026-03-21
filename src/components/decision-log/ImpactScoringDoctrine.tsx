import { Card, CardContent } from "@/components/ui/card";
import { Scale } from "lucide-react";

const bands = [
  { range: "0–20", label: "Negligible", color: "text-muted-foreground" },
  { range: "21–40", label: "Low operational value", color: "text-warning" },
  { range: "41–60", label: "Moderate decision value", color: "text-accent-foreground" },
  { range: "61–80", label: "High decision value", color: "text-primary" },
  { range: "81–100", label: "Major measured value", color: "text-success" },
] as const;

const criteria = [
  "Earlier action taken",
  "Cost avoided",
  "Better prioritization",
  "Reduced response delay",
  "Improved allocation quality",
];

const ImpactScoringDoctrine = () => (
  <Card className="border-primary/20 bg-primary/5">
    <CardContent className="p-4 space-y-3">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <Scale className="h-3.5 w-3.5 text-primary" />
        Impact Scoring Standard
      </p>
      <div className="grid grid-cols-5 gap-2">
        {bands.map((b) => (
          <div key={b.range} className="text-center">
            <p className={`text-xs font-bold ${b.color}`}>{b.range}</p>
            <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{b.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Score must be based on: {criteria.join(" · ")}
      </p>
    </CardContent>
  </Card>
);

export default ImpactScoringDoctrine;
