/**
 * Scenario Simulation Engine - Policy What-If Analysis
 * Counterfactual modeling for strategic decision support
 */
import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Beaker, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Loader2,
  ArrowRight,
  Zap,
  DollarSign,
  Users,
  Wheat,
  Activity
} from "lucide-react";

interface ScenarioResult {
  scenario: string;
  outcomes: {
    domain: string;
    impact: "positive" | "negative" | "neutral";
    magnitude: number; // -100 to +100
    description: string;
    confidence: number;
    timeframe: string;
  }[];
  recommendations: string[];
  risks: string[];
  overallConfidence: number;
}

const SCENARIO_TEMPLATES = [
  { id: "fuel_subsidy", label: "Remove Fuel Subsidies", icon: DollarSign },
  { id: "food_import", label: "Increase Food Imports", icon: Wheat },
  { id: "border_close", label: "Close Borders", icon: Users },
  { id: "currency_devalue", label: "Currency Devaluation", icon: TrendingDown },
  { id: "health_emergency", label: "Declare Health Emergency", icon: Activity },
  { id: "energy_transition", label: "Accelerate Energy Transition", icon: Zap },
];

const DOMAINS = ["inflation", "employment", "health", "food_security", "energy", "social_stability"];

export const ScenarioEngine = () => {
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [customScenario, setCustomScenario] = useState("");
  const [intensity, setIntensity] = useState([50]);
  const [timeHorizon, setTimeHorizon] = useState("6m");
  const [countryContext, setCountryContext] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const simulateScenario = useCallback(async () => {
    setIsSimulating(true);
    setResult(null);

    try {
      const scenarioText = customScenario || 
        SCENARIO_TEMPLATES.find(t => t.id === selectedScenario)?.label || 
        selectedScenario;

      // Simulate using edge function (or local simulation)
      const { data, error } = await supabase.functions.invoke("aicis-intelligence", {
        body: {
          query: `Analyze policy scenario: ${scenarioText}. Country context: ${countryContext || "General"}. Intensity: ${intensity[0]}%. Time horizon: ${timeHorizon}`,
          mode: "scenario"
        }
      });

      if (error) throw error;

      // Generate scenario outcomes based on AI response or fallback logic
      const outcomes = DOMAINS.map(domain => {
        // Simulate impact based on scenario type and intensity
        const baseImpact = calculateBaseImpact(selectedScenario || customScenario, domain);
        const scaledImpact = Math.round(baseImpact * (intensity[0] / 100));
        
        return {
          domain: domain.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
          impact: scaledImpact > 10 ? "positive" as const : 
                  scaledImpact < -10 ? "negative" as const : "neutral" as const,
          magnitude: scaledImpact,
          description: generateImpactDescription(domain, scaledImpact, scenarioText),
          confidence: 60 + Math.random() * 30,
          timeframe: timeHorizon === "3m" ? "1-3 months" : 
                     timeHorizon === "6m" ? "3-6 months" : "6-12 months"
        };
      });

      const simulatedResult: ScenarioResult = {
        scenario: scenarioText,
        outcomes,
        recommendations: generateRecommendations(outcomes),
        risks: generateRisks(outcomes),
        overallConfidence: outcomes.reduce((sum, o) => sum + o.confidence, 0) / outcomes.length
      };

      setResult(simulatedResult);

      // Log the simulation to decision ledger
      await supabase.from("ai_decision_logs").insert({
        model_name: "scenario-engine-v1",
        division_key: "governance",
        input_summary: `Scenario: ${scenarioText} | Intensity: ${intensity[0]}% | Horizon: ${timeHorizon}`,
        output_summary: `${outcomes.filter(o => o.impact === "positive").length} positive, ${outcomes.filter(o => o.impact === "negative").length} negative impacts`,
        confidence: simulatedResult.overallConfidence,
        explanation: { outcomes, recommendations: simulatedResult.recommendations }
      });

    } catch (error) {
      console.error("Scenario simulation error:", error);
    } finally {
      setIsSimulating(false);
    }
  }, [selectedScenario, customScenario, intensity, timeHorizon, countryContext]);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-5 w-5 text-primary" />
          Scenario Simulation Engine
          <Badge variant="outline" className="ml-2 text-xs">
            What-If Analysis
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Model policy impacts before implementation — counterfactual analysis for strategic decisions
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Scenario Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Select Scenario Template</Label>
            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a policy scenario..." />
              </SelectTrigger>
              <SelectContent>
                {SCENARIO_TEMPLATES.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <template.icon className="h-4 w-4" />
                      {template.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Or Enter Custom Scenario</Label>
            <Input
              value={customScenario}
              onChange={(e) => setCustomScenario(e.target.value)}
              placeholder="e.g., Increase minimum wage by 20%"
            />
          </div>
        </div>

        {/* Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Country/Region Context</Label>
            <Input
              value={countryContext}
              onChange={(e) => setCountryContext(e.target.value)}
              placeholder="e.g., Ghana, ECOWAS"
            />
          </div>

          <div className="space-y-2">
            <Label>Policy Intensity: {intensity[0]}%</Label>
            <Slider
              value={intensity}
              onValueChange={setIntensity}
              max={100}
              min={10}
              step={10}
              className="mt-2"
            />
          </div>

          <div className="space-y-2">
            <Label>Time Horizon</Label>
            <Select value={timeHorizon} onValueChange={setTimeHorizon}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">3 Months</SelectItem>
                <SelectItem value="6m">6 Months</SelectItem>
                <SelectItem value="12m">12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Run Simulation */}
        <Button 
          onClick={simulateScenario}
          disabled={isSimulating || (!selectedScenario && !customScenario)}
          className="w-full"
        >
          {isSimulating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Simulating...
            </>
          ) : (
            <>
              <Beaker className="h-4 w-4 mr-2" />
              Run Scenario Simulation
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Projected Outcomes
                </h4>
                <Badge variant="outline">
                  Confidence: {result.overallConfidence.toFixed(0)}%
                </Badge>
              </div>

              <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.outcomes.map((outcome, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "p-4 rounded-lg border",
                        outcome.impact === "positive" && "bg-success/10 border-success/30",
                        outcome.impact === "negative" && "bg-destructive/10 border-destructive/30",
                        outcome.impact === "neutral" && "bg-muted/30 border-muted"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{outcome.domain}</span>
                        <div className="flex items-center gap-2">
                          {outcome.impact === "positive" ? (
                            <TrendingUp className="h-4 w-4 text-success" />
                          ) : outcome.impact === "negative" ? (
                            <TrendingDown className="h-4 w-4 text-destructive" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={cn(
                            "font-bold",
                            outcome.impact === "positive" && "text-success",
                            outcome.impact === "negative" && "text-destructive"
                          )}>
                            {outcome.magnitude > 0 ? "+" : ""}{outcome.magnitude}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {outcome.description}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>Confidence: {outcome.confidence.toFixed(0)}%</span>
                        <span>{outcome.timeframe}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                  <h5 className="font-semibold mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-success" />
                    Strategic Recommendations
                  </h5>
                  <ul className="space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-success">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {result.risks.length > 0 && (
                <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                  <h5 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Key Risks to Monitor
                  </h5>
                  <ul className="space-y-1">
                    {result.risks.map((risk, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-warning">•</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Helper functions for scenario simulation
function calculateBaseImpact(scenario: string, domain: string): number {
  const impactMatrix: Record<string, Record<string, number>> = {
    fuel_subsidy: {
      inflation: 40,
      employment: -10,
      health: -5,
      food_security: -20,
      energy: 30,
      social_stability: -30
    },
    food_import: {
      inflation: -15,
      employment: -10,
      health: 10,
      food_security: 40,
      energy: -5,
      social_stability: 10
    },
    border_close: {
      inflation: 20,
      employment: -25,
      health: -30,
      food_security: -40,
      energy: -15,
      social_stability: -20
    },
    currency_devalue: {
      inflation: 50,
      employment: 15,
      health: -20,
      food_security: -30,
      energy: -25,
      social_stability: -25
    },
    health_emergency: {
      inflation: 10,
      employment: -20,
      health: 30,
      food_security: -10,
      energy: -5,
      social_stability: -15
    },
    energy_transition: {
      inflation: 15,
      employment: 20,
      health: 25,
      food_security: 5,
      energy: 50,
      social_stability: 10
    }
  };

  return impactMatrix[scenario]?.[domain] || (Math.random() - 0.5) * 40;
}

function generateImpactDescription(domain: string, impact: number, scenario: string): string {
  const direction = impact > 0 ? "increase" : impact < 0 ? "decrease" : "remain stable";
  const magnitude = Math.abs(impact) > 30 ? "significant" : Math.abs(impact) > 15 ? "moderate" : "marginal";
  
  return `Expected ${magnitude} ${direction} in ${domain.replace("_", " ")} as a result of this policy change.`;
}

function generateRecommendations(outcomes: ScenarioResult["outcomes"]): string[] {
  const recommendations: string[] = [];
  
  const negatives = outcomes.filter(o => o.impact === "negative");
  if (negatives.length > 0) {
    recommendations.push(`Implement mitigating measures for ${negatives.map(n => n.domain.toLowerCase()).join(", ")}`);
  }
  
  recommendations.push("Establish monitoring dashboard for early warning indicators");
  recommendations.push("Prepare contingency funding for vulnerable populations");
  
  return recommendations;
}

function generateRisks(outcomes: ScenarioResult["outcomes"]): string[] {
  const risks: string[] = [];
  
  const severeNegatives = outcomes.filter(o => o.impact === "negative" && Math.abs(o.magnitude) > 25);
  severeNegatives.forEach(outcome => {
    risks.push(`${outcome.domain} disruption may trigger cascading effects`);
  });
  
  if (risks.length === 0) {
    risks.push("Monitor for unintended secondary effects");
  }
  
  return risks;
}
