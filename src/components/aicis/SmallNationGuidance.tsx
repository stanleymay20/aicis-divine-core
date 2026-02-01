import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Lightbulb, 
  Target, 
  TrendingUp, 
  Shield, 
  AlertTriangle,
  ExternalLink,
  Info,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GuidanceItem {
  priority: "critical" | "high" | "medium" | "low";
  domain: string;
  title: string;
  description: string;
  actionable: string;
  sdgAlignment?: number[];
}

interface SmallNationGuidanceProps {
  countryName: string;
  iso3?: string;
  dataCompleteness: number;
  vulnerabilityScore?: number;
  guidance: GuidanceItem[];
  sources: string[];
  lastUpdated?: string;
}

const priorityColors = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  low: "bg-green-500/20 text-green-400 border-green-500/50"
};

const priorityIcons = {
  critical: AlertTriangle,
  high: Shield,
  medium: Target,
  low: TrendingUp
};

export function SmallNationGuidance({
  countryName,
  iso3,
  dataCompleteness,
  vulnerabilityScore,
  guidance,
  sources,
  lastUpdated
}: SmallNationGuidanceProps) {
  const navigate = useNavigate();

  const getCompletenessStatus = (score: number) => {
    if (score >= 0.7) return { label: "Comprehensive", color: "text-success" };
    if (score >= 0.4) return { label: "Partial", color: "text-warning" };
    return { label: "Limited", color: "text-destructive" };
  };

  const status = getCompletenessStatus(dataCompleteness);

  return (
    <div className="space-y-4">
      {/* Data Transparency Alert */}
      {dataCompleteness < 0.5 && (
        <Alert variant="default" className="border-warning/50 bg-warning/10">
          <Info className="h-4 w-4" />
          <AlertTitle>Data Coverage Notice</AlertTitle>
          <AlertDescription>
            <strong>{countryName}</strong> has limited data availability ({Math.round(dataCompleteness * 100)}% coverage). 
            AICIS aggregates from {sources.length} sources, but gaps may exist. 
            Recommendations should be validated with local experts.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Header */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Strategic Guidance: {countryName}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={status.color}>
                {status.label} Data ({Math.round(dataCompleteness * 100)}%)
              </Badge>
              {vulnerabilityScore !== undefined && (
                <Badge 
                  variant="outline"
                  className={vulnerabilityScore > 60 ? "text-destructive border-destructive/50" : 
                           vulnerabilityScore > 30 ? "text-warning border-warning/50" : 
                           "text-success border-success/50"}
                >
                  Risk: {vulnerabilityScore}/100
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sources Transparency */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Data Sources:</span>
            {sources.map((source, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {source}
              </Badge>
            ))}
          </div>

          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prioritized Recommendations */}
      <div className="grid gap-3">
        {guidance.map((item, index) => {
          const Icon = priorityIcons[item.priority];
          return (
            <Card key={index} className="bg-card/30 backdrop-blur border-border/50">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className={`p-2 rounded-lg ${priorityColors[item.priority]} flex-shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold">{item.title}</h4>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {item.domain}
                        </Badge>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${priorityColors[item.priority]}`}
                      >
                        {item.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                    <div className="flex items-start gap-2 bg-primary/5 p-2 rounded-md">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-primary">
                        <strong>Action:</strong> {item.actionable}
                      </p>
                    </div>
                    {item.sdgAlignment && item.sdgAlignment.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>SDG Alignment:</span>
                        {item.sdgAlignment.map(sdg => (
                          <Badge key={sdg} variant="secondary" className="text-xs">
                            SDG {sdg}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Deep Dive Link */}
      {iso3 && (
        <div className="flex justify-center pt-2">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/deepdive/${iso3}`)}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View Full Country Profile
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper function to generate guidance from data context
export function generateNationGuidance(
  countryData: any,
  vulnerabilities: any,
  alerts: any[],
  crises: any[]
): GuidanceItem[] {
  const guidance: GuidanceItem[] = [];

  // Critical security issues
  const activeConflicts = crises.filter((c: any) => 
    c.status !== "resolved" && c.severity >= 7
  );
  if (activeConflicts.length > 0) {
    guidance.push({
      priority: "critical",
      domain: "Security",
      title: "Active Conflict Situation",
      description: `${activeConflicts.length} ongoing crisis event(s) require immediate attention.`,
      actionable: "Establish crisis coordination center, engage humanitarian partners, and implement civilian protection protocols.",
      sdgAlignment: [16]
    });
  }

  // High vulnerability areas
  if (vulnerabilities?.overall_score > 60) {
    guidance.push({
      priority: "high",
      domain: "Vulnerability",
      title: "Elevated Systemic Risk",
      description: `Overall vulnerability score of ${vulnerabilities.overall_score}/100 indicates heightened fragility.`,
      actionable: "Prioritize resilience investments in most vulnerable sectors and establish early warning mechanisms.",
      sdgAlignment: [1, 10, 16]
    });
  }

  // Health emergencies
  const healthAlerts = alerts.filter((a: any) => 
    a.division === "health" && (a.severity === "critical" || a.severity === "high")
  );
  if (healthAlerts.length > 0) {
    guidance.push({
      priority: "high",
      domain: "Health",
      title: "Health System Alert",
      description: `${healthAlerts.length} active health alert(s) detected.`,
      actionable: "Strengthen disease surveillance, ensure medical supply chains, and coordinate with WHO regional office.",
      sdgAlignment: [3]
    });
  }

  // Food security
  const foodAlerts = alerts.filter((a: any) => a.division === "food");
  if (foodAlerts.length > 0) {
    guidance.push({
      priority: foodAlerts.some((a: any) => a.severity === "critical") ? "critical" : "medium",
      domain: "Food Security",
      title: "Food Supply Concerns",
      description: "Indicators suggest potential food security stress.",
      actionable: "Activate strategic reserves, engage WFP for early intervention, and support agricultural inputs for next season.",
      sdgAlignment: [2]
    });
  }

  // Governance improvements
  if (countryData?.kpis?.governance?.completeness < 0.5) {
    guidance.push({
      priority: "medium",
      domain: "Governance",
      title: "Strengthen Institutional Capacity",
      description: "Limited governance data suggests potential institutional development opportunities.",
      actionable: "Consider technical assistance programs for statistical capacity and transparency initiatives.",
      sdgAlignment: [16, 17]
    });
  }

  // Economic resilience
  if (vulnerabilities?.economic_score > 50) {
    guidance.push({
      priority: "medium",
      domain: "Economy",
      title: "Economic Diversification",
      description: "Economic vulnerability indicators suggest over-reliance on limited sectors.",
      actionable: "Develop economic diversification strategy focusing on sustainable industries and regional trade integration.",
      sdgAlignment: [8, 9]
    });
  }

  // Climate adaptation
  if (vulnerabilities?.climate_score > 40) {
    guidance.push({
      priority: "medium",
      domain: "Climate",
      title: "Climate Adaptation Planning",
      description: "Climate vulnerability requires proactive adaptation measures.",
      actionable: "Integrate climate risk into national planning, access Green Climate Fund, and invest in resilient infrastructure.",
      sdgAlignment: [13]
    });
  }

  // Default guidance for small nations
  if (guidance.length === 0) {
    guidance.push({
      priority: "low",
      domain: "Strategic",
      title: "Continued Monitoring",
      description: "No critical alerts detected. Continue regular monitoring and capacity building.",
      actionable: "Maintain data reporting to international systems, strengthen regional partnerships, and invest in human capital.",
      sdgAlignment: [17]
    });
  }

  return guidance;
}
