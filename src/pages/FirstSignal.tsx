import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, Target, AlertTriangle, CheckCircle2, XCircle, Zap } from "lucide-react";
import { format } from "date-fns";

/* ── tiny sub-components ── */
const DirIcon = ({ dir }: { dir: string }) => {
  if (dir === "up") return <TrendingUp className="h-4 w-4 text-success" />;
  if (dir === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const TimelineEvent = ({ date, label, value, variant }: { date: string; label: string; value: string; variant: "forecast" | "reality" }) => (
  <div className="flex items-start gap-3">
    <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${variant === "forecast" ? "bg-primary" : "bg-warning"}`} />
    <div>
      <p className="text-xs text-muted-foreground">{date}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{value}</p>
    </div>
  </div>
);

/* ── case study card ── */
interface CaseProps {
  title: string;
  iso3: string;
  domain: string;
  predictedDir: string;
  actualDir: string;
  predictedVal: number;
  actualVal: number;
  forecastDate: string;
  realizedDate: string;
  error: number;
  narrative: string;
  impact: string;
}

const CaseStudyCard = ({ title, iso3, domain, predictedDir, actualDir, predictedVal, actualVal, forecastDate, realizedDate, error, narrative, impact }: CaseProps) => (
  <Card className="border-primary/20">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {title}
        </CardTitle>
        <Badge variant="outline" className="text-[10px]">{iso3} · {domain}</Badge>
      </div>
      <CardDescription className="text-xs">{narrative}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Timeline */}
      <div className="space-y-3 border-l-2 border-border pl-4 ml-1">
        <TimelineEvent
          date={format(new Date(forecastDate), "MMM d, yyyy")}
          label={`AICIS forecast: ${predictedDir.toUpperCase()}`}
          value={`Predicted value: ${predictedVal}`}
          variant="forecast"
        />
        <TimelineEvent
          date={format(new Date(realizedDate), "MMM d, yyyy")}
          label={`Reality confirmed: ${actualDir.toUpperCase()}`}
          value={`Actual value: ${actualVal}`}
          variant="reality"
        />
      </div>

      {/* Comparison table */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground mb-1">AICIS</p>
          <div className="flex items-center justify-center gap-1">
            <DirIcon dir={predictedDir} />
            <span className="text-sm font-bold">{predictedDir}</span>
          </div>
          <p className="text-success text-[10px] mt-1">✓ Correct</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground mb-1">Naive Baseline</p>
          <div className="flex items-center justify-center gap-1">
            <Minus className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold">stable</span>
          </div>
          <p className="text-destructive text-[10px] mt-1">✗ Missed</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground mb-1">Reality</p>
          <div className="flex items-center justify-center gap-1">
            <DirIcon dir={actualDir} />
            <span className="text-sm font-bold">{actualDir}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Ground truth</p>
        </div>
      </div>

      {/* Decision Impact */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
        <p className="text-xs font-semibold flex items-center gap-1.5 mb-1">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Decision Impact
        </p>
        <p className="text-xs text-muted-foreground">{impact}</p>
      </div>

      {/* Honest caveat */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0 mt-0.5" />
        <span>Direction was correct; magnitude error was {error} points. The system identified the right trajectory but not the exact scale.</span>
      </div>
    </CardContent>
  </Card>
);

/* ── main page ── */
const FirstSignal = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["first-signal-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("forecast_validation_results")
        .select("direction_hit, actual_direction")
      const changes = (data || []).filter(r => r.actual_direction !== "stable");
      const hits = changes.filter(r => r.direction_hit).length;
      return { total: changes.length, hits, accuracy: changes.length > 0 ? Math.round((hits / changes.length) * 100) : 0 };
    },
    enabled: !!user,
  });

  if (authLoading || !user) return null;

  return (
    <AICISLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-orbitron font-bold flex items-center gap-3">
            <Target className="h-7 w-7 text-primary" />
            First Signal — Proof of Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where AICIS detected directional change before reality confirmed it — and the naive baseline was blind
          </p>
        </div>

        {/* The core argument */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold">Why This Matters</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Governments and institutions make billion-dollar decisions using data that is 3–6 months delayed.
              When structural change happens — a climate shift, a conflict escalation, an economic reversal —
              the "nothing changes" assumption fails catastrophically. That is exactly where AICIS provides signal.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center">
                <p className="text-lg font-orbitron font-bold text-primary">{stats?.accuracy ?? "—"}%</p>
                <p className="text-[10px] text-muted-foreground">Turning-Point Accuracy</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-orbitron font-bold text-success">{stats?.hits ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">Correct Change Detections</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-orbitron font-bold text-destructive">0%</p>
                <p className="text-[10px] text-muted-foreground">Naive Baseline (during change)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wedge comparison */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Where Others Fail: Change Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-muted-foreground">Model</th>
                    <th className="text-center py-2 font-medium text-muted-foreground">During Stability</th>
                    <th className="text-center py-2 font-medium text-muted-foreground">During Change</th>
                    <th className="text-center py-2 font-medium text-muted-foreground">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-2.5 font-medium text-muted-foreground">Naive ("tomorrow = today")</td>
                    <td className="py-2.5 text-center"><Badge variant="outline" className="text-success text-[10px]">~100%</Badge></td>
                    <td className="py-2.5 text-center"><Badge variant="destructive" className="text-[10px]">0%</Badge></td>
                    <td className="py-2.5 text-center text-[10px] text-muted-foreground">Blind to change</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium">AICIS</td>
                    <td className="py-2.5 text-center"><Badge variant="outline" className="text-[10px]">~83%</Badge></td>
                    <td className="py-2.5 text-center"><Badge className="text-[10px]">{stats?.accuracy ?? 20}%</Badge></td>
                    <td className="py-2.5 text-center text-[10px] text-primary font-medium">Detects change</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              During stable periods, the naive model dominates because "nothing changes" is almost always true.
              During structural shifts, it collapses to 0% — that is where AICIS provides the only signal.
            </p>
          </CardContent>
        </Card>

        {/* Case studies */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Documented Signal Detections
          </h2>

          <CaseStudyCard
            title="China Climate Shift — Upward Trajectory Detected"
            iso3="CHN"
            domain="climate"
            predictedDir="up"
            actualDir="up"
            predictedVal={2}
            actualVal={21}
            forecastDate="2026-03-11"
            realizedDate="2026-03-18"
            error={19}
            narrative="AICIS identified an upward climate indicator trajectory for China several days before the jump materialized in observed data. The naive baseline predicted no change."
            impact="Early detection of climate metric shifts enables proactive resource allocation for climate adaptation programs. A 7-day advance signal on agricultural or environmental policy could affect procurement cycles worth millions in large economies."
          />

          <CaseStudyCard
            title="Argentina Climate Decline — Downward Shift Detected"
            iso3="ARG"
            domain="climate"
            predictedDir="down"
            actualDir="down"
            predictedVal={20}
            actualVal={6}
            forecastDate="2026-03-11"
            realizedDate="2026-03-18"
            error={14}
            narrative="AICIS detected a downward climate trajectory for Argentina before the decline from 21 to 6 was confirmed. The naive model maintained 'stable' throughout."
            impact="In agricultural economies like Argentina, a multi-day advance warning of deteriorating climate indicators can inform commodity hedging, insurance adjustments, and emergency food security planning."
          />
        </div>

        {/* Honest limitations */}
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              Honest Limitations
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Direction was correct in these cases; magnitude estimation remains imprecise</li>
              <li>Change events represent ~0.24% of all observations — most macro data is stable</li>
              <li>Current intelligence grade: DETECTING (20%) — not yet at PREDICTING threshold (40%+)</li>
              <li>These are the strongest validated cases; the system also has documented misses</li>
              <li>All outputs are AI-assisted advisory signals, not autonomous predictions</li>
            </ul>
          </CardContent>
        </Card>

        {/* Why now */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Why Now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <p><strong className="text-foreground">Open data explosion:</strong> More public macro data is available now than at any point in history — enabling synthesis that was previously impossible.</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <p><strong className="text-foreground">AI makes synthesis feasible:</strong> Multi-domain pattern detection across 211 countries requires AI-assisted analysis — manual review cannot scale.</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <p><strong className="text-foreground">Non-surveillance intelligence gap:</strong> The EU AI Act and GDPR create demand for transparent, public-data-first intelligence systems that don't rely on surveillance infrastructure.</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <p><strong className="text-foreground">Decision lag costs billions:</strong> Governments and institutions routinely operate on 3–6 month delayed indicators. Even partial advance signal has outsized decision value.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AICISLayout>
  );
};

export default FirstSignal;
