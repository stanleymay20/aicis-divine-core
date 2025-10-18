import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Brain, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImpactMetric {
  division: string;
  impact_score: number;
  impact_per_sc: number;
  captured_at: string;
}

interface LearningWeight {
  division: string;
  impact_weight: number;
  trend: number;
  last_updated: string;
}

export default function LearningAllocatorPanel() {
  const [impacts, setImpacts] = useState<ImpactMetric[]>([]);
  const [weights, setWeights] = useState<LearningWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);

    // Get latest impact metrics per division
    const { data: impactData } = await supabase
      .from("division_impact_metrics")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(50);

    // Get learning weights
    const { data: weightData } = await supabase
      .from("division_learning_weights")
      .select("*")
      .order("impact_weight", { ascending: false });

    // Group impacts by division (latest only)
    const latestImpacts = new Map();
    impactData?.forEach(i => {
      if (!latestImpacts.has(i.division)) {
        latestImpacts.set(i.division, i);
      }
    });

    setImpacts(Array.from(latestImpacts.values()));
    setWeights(weightData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const evaluateImpactNow = async () => {
    toast({ title: "Evaluating impact...", description: "Analyzing division performance" });
    const { error } = await supabase.functions.invoke("evaluate-impact");
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Impact evaluated", description: "Impact metrics updated" });
      loadData();
    }
  };

  const relearnNow = async () => {
    toast({ title: "Re-learning weights...", description: "Updating policy weights" });
    const { error } = await supabase.functions.invoke("learn-policy-weights");
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Learning complete", description: "Allocator weights updated" });
      loadData();
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0.01) return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend < -0.01) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <span className="text-muted-foreground">—</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Learning Allocator</h2>
        </div>
        <div className="flex gap-2">
          <Button onClick={evaluateImpactNow} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Evaluate Impact
          </Button>
          <Button onClick={relearnNow} variant="outline" size="sm">
            <Brain className="mr-2 h-4 w-4" />
            Re-Learn Weights
          </Button>
        </div>
      </div>

      {loading && <p className="text-muted-foreground">Loading learning data...</p>}

      {!loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Impact Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📊 Recent Impact Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {impacts.length === 0 && (
                  <p className="text-muted-foreground text-sm">No impact data yet. Run a rebalance first.</p>
                )}
                {impacts.map((impact) => (
                  <div key={impact.division} className="flex justify-between items-center p-3 rounded-lg border">
                    <div>
                      <span className="font-semibold capitalize">{impact.division}</span>
                      <p className="text-xs text-muted-foreground">
                        {new Date(impact.captured_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={impact.impact_score > 0 ? "default" : "secondary"}>
                        Impact: {impact.impact_score.toFixed(2)}
                      </Badge>
                      <p className="text-xs mt-1">
                        {impact.impact_per_sc.toFixed(4)} / SC
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Learned Weights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🧮 Learned Weights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {weights.length === 0 && (
                  <p className="text-muted-foreground text-sm">No learning weights yet.</p>
                )}
                {weights.map((weight) => (
                  <div key={weight.division} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{weight.division}</span>
                        {getTrendIcon(weight.trend)}
                      </div>
                      <span className="text-sm font-mono">
                        {(weight.impact_weight * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${weight.impact_weight * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(weight.last_updated).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4" />
              How Learning Works
            </h3>
            <p className="text-sm text-muted-foreground">
              AICIS continuously measures the real-world impact of SC allocations. After each rebalance,
              it evaluates improvements in stability, risk reduction, and yield per SC spent. These metrics
              are used to automatically update policy weights via exponential moving average (α=0.3),
              ensuring the allocator learns which divisions deliver the highest returns and prioritizes
              them in future allocations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
