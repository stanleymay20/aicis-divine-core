/**
 * Outcome KPI Tracker - Policy-to-Outcome Measurement
 * Tracks real-world outcomes tied to AICIS recommendations
 */
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  BarChart3,
  Activity,
  Heart,
  Wheat,
  Zap,
  RefreshCw
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subMonths } from "date-fns";

interface OutcomeKPI {
  id: string;
  domain: string;
  metric: string;
  unit: string;
  baseline: number;
  current: number;
  target: number;
  trend: "improving" | "declining" | "stable";
  lastUpdated: string;
  history: { date: string; value: number }[];
}

interface DivisionKPI {
  id: string;
  division: string;
  metric: Record<string, unknown>;
  composite_score: number | null;
  risk_score: number | null;
  captured_at: string;
}

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  health: Heart,
  food: Wheat,
  energy: Zap,
  governance: Target,
  finance: BarChart3,
  security: Activity
};

export const OutcomeKPITracker = () => {
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [divisionKPIs, setDivisionKPIs] = useState<DivisionKPI[]>([]);
  const [outcomeKPIs, setOutcomeKPIs] = useState<OutcomeKPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchKPIData();
  }, []);

  const fetchKPIData = async () => {
    setIsLoading(true);
    try {
      // Fetch division KPIs from database
      const { data: kpiData } = await supabase
        .from("division_kpis")
        .select("*")
        .order("captured_at", { ascending: false })
        .limit(100);

      if (kpiData) {
        setDivisionKPIs(kpiData as DivisionKPI[]);
        
        // Transform into outcome KPIs with history
        const transformedKPIs = transformToOutcomeKPIs(kpiData as DivisionKPI[]);
        setOutcomeKPIs(transformedKPIs);
      }
    } catch (error) {
      console.error("Error fetching KPI data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    await fetchKPIData();
    setIsRefreshing(false);
  };

  const transformToOutcomeKPIs = (kpis: DivisionKPI[]): OutcomeKPI[] => {
    // Group by division
    const byDivision = kpis.reduce((acc, kpi) => {
      if (!acc[kpi.division]) acc[kpi.division] = [];
      acc[kpi.division].push(kpi);
      return acc;
    }, {} as Record<string, DivisionKPI[]>);

    const outcomes: OutcomeKPI[] = [];

    Object.entries(byDivision).forEach(([division, divKpis]) => {
      const sorted = divKpis.sort((a, b) => 
        new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      );
      
      const latest = sorted[0];
      const oldest = sorted[sorted.length - 1];
      
      const currentScore = latest.composite_score || 50;
      const baselineScore = oldest.composite_score || 50;
      const trend = currentScore > baselineScore + 5 ? "improving" :
                    currentScore < baselineScore - 5 ? "declining" : "stable";

      outcomes.push({
        id: division,
        domain: division,
        metric: "Composite Score",
        unit: "index",
        baseline: baselineScore,
        current: currentScore,
        target: 80, // Default target
        trend,
        lastUpdated: latest.captured_at,
        history: sorted.slice(0, 12).reverse().map(k => ({
          date: format(new Date(k.captured_at), "MMM d"),
          value: k.composite_score || 0
        }))
      });

      // Add risk score as separate KPI
      if (latest.risk_score !== null) {
        outcomes.push({
          id: `${division}-risk`,
          domain: division,
          metric: "Risk Score",
          unit: "level",
          baseline: oldest.risk_score || 50,
          current: latest.risk_score,
          target: 20, // Lower is better for risk
          trend: latest.risk_score < (oldest.risk_score || 50) - 5 ? "improving" :
                 latest.risk_score > (oldest.risk_score || 50) + 5 ? "declining" : "stable",
          lastUpdated: latest.captured_at,
          history: sorted.slice(0, 12).reverse().map(k => ({
            date: format(new Date(k.captured_at), "MMM d"),
            value: k.risk_score || 0
          }))
        });
      }
    });

    return outcomes;
  };

  const filteredKPIs = selectedDomain === "all" 
    ? outcomeKPIs 
    : outcomeKPIs.filter(k => k.domain === selectedDomain);

  const getProgressColor = (current: number, target: number, isRisk: boolean = false) => {
    if (isRisk) {
      // For risk, lower is better
      if (current <= target) return "bg-success";
      if (current <= target * 1.5) return "bg-warning";
      return "bg-destructive";
    }
    // For positive metrics, higher is better
    const progress = (current / target) * 100;
    if (progress >= 80) return "bg-success";
    if (progress >= 50) return "bg-warning";
    return "bg-destructive";
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Outcome KPI Tracker
            <Badge variant="outline" className="ml-2 text-xs">
              Policy → Outcome Loops
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Track real-world outcomes tied to AICIS recommendations — what actually changed?
        </p>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="impact">Impact</TabsTrigger>
            </TabsList>

            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                <SelectItem value="health">Health</SelectItem>
                <SelectItem value="food">Food Security</SelectItem>
                <SelectItem value="energy">Energy</SelectItem>
                <SelectItem value="governance">Governance</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="overview">
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredKPIs.map((kpi) => {
                  const DomainIcon = DOMAIN_ICONS[kpi.domain] || Target;
                  const isRisk = kpi.metric.toLowerCase().includes("risk");
                  const progress = isRisk 
                    ? Math.max(0, 100 - (kpi.current / kpi.target) * 100)
                    : (kpi.current / kpi.target) * 100;

                  return (
                    <div 
                      key={kpi.id}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <DomainIcon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium capitalize">{kpi.domain}</span>
                        </div>
                        <Badge 
                          variant="outline"
                          className={cn(
                            kpi.trend === "improving" && "bg-success/10 text-success",
                            kpi.trend === "declining" && "bg-destructive/10 text-destructive",
                            kpi.trend === "stable" && "bg-muted text-muted-foreground"
                          )}
                        >
                          {kpi.trend === "improving" && <TrendingUp className="h-3 w-3 mr-1" />}
                          {kpi.trend === "declining" && <TrendingDown className="h-3 w-3 mr-1" />}
                          {kpi.trend === "stable" && <ArrowRight className="h-3 w-3 mr-1" />}
                          {kpi.trend}
                        </Badge>
                      </div>

                      <div className="mb-2">
                        <p className="text-sm text-muted-foreground">{kpi.metric}</p>
                      </div>

                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          Baseline: {kpi.baseline.toFixed(1)}
                        </span>
                        <span className="font-bold text-lg">
                          {kpi.current.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">
                          Target: {kpi.target}
                        </span>
                      </div>

                      <Progress 
                        value={Math.min(100, progress)}
                        className="h-2"
                      />

                      <p className="text-xs text-muted-foreground mt-2">
                        Updated: {format(new Date(kpi.lastUpdated), "MMM d, HH:mm")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="trends">
            <div className="space-y-6">
              {filteredKPIs.filter(k => k.history.length > 1).slice(0, 4).map((kpi) => (
                <div key={kpi.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold capitalize">
                      {kpi.domain} - {kpi.metric}
                    </h4>
                    <Badge 
                      variant="outline"
                      className={cn(
                        kpi.trend === "improving" && "bg-success/10 text-success",
                        kpi.trend === "declining" && "bg-destructive/10 text-destructive"
                      )}
                    >
                      {kpi.trend}
                    </Badge>
                  </div>

                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={kpi.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis 
                          dataKey="date" 
                          fontSize={10}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis 
                          fontSize={10}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            background: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))"
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke={kpi.trend === "improving" ? "hsl(var(--success))" : 
                                  kpi.trend === "declining" ? "hsl(var(--destructive))" : 
                                  "hsl(var(--primary))"}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="impact">
            <div className="p-6 text-center bg-muted/30 rounded-lg">
              <Target className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Impact Measurement</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Track how AICIS recommendations translate to real-world improvements.
                This connects policy actions to measurable outcomes.
              </p>
              
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="p-3 bg-success/10 rounded-lg">
                  <p className="text-2xl font-bold text-success">
                    {outcomeKPIs.filter(k => k.trend === "improving").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Improving</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    {outcomeKPIs.filter(k => k.trend === "stable").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Stable</p>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-2xl font-bold text-destructive">
                    {outcomeKPIs.filter(k => k.trend === "declining").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Declining</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
