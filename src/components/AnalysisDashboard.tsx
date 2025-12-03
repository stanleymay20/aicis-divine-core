import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  BarChart3, LineChart, PieChart, Activity, Map, Table2, 
  TrendingUp, Globe, Target, Filter, LayoutGrid
} from "lucide-react";
import { MetricsPanel } from "./MetricsPanel";
import { PredictiveIntelligence } from "./PredictiveIntelligence";
import SDGDashboard from "./SDGDashboard";
import { GlobalVulnerabilityMap } from "./GlobalVulnerabilityMap";
import { FinancialPanel } from "./FinancialPanel";
import { HealthcarePanel } from "./HealthcarePanel";
import { FoodSecurityPanel } from "./FoodSecurityPanel";
import { EnergyPanel } from "./EnergyPanel";
import { UnifiedGovernancePanel } from "./UnifiedGovernancePanel";
import { IntelligenceHub } from "./IntelligenceHub";

type VisualizationType = 
  | "metrics" 
  | "predictions" 
  | "sdg" 
  | "map" 
  | "finance" 
  | "health" 
  | "food" 
  | "energy" 
  | "governance"
  | "intelligence";

interface VisualizationOption {
  id: VisualizationType;
  label: string;
  icon: React.ElementType;
  description: string;
}

const VISUALIZATION_OPTIONS: VisualizationOption[] = [
  { id: "metrics", label: "System Metrics", icon: BarChart3, description: "Revenue & operations charts" },
  { id: "predictions", label: "Predictive Intelligence", icon: TrendingUp, description: "AI-driven forecasts" },
  { id: "sdg", label: "SDG Progress", icon: Target, description: "UN Sustainable Development Goals" },
  { id: "map", label: "Global Map", icon: Map, description: "Vulnerability & crisis mapping" },
  { id: "finance", label: "Financial Analysis", icon: LineChart, description: "Market & economic data" },
  { id: "health", label: "Healthcare Analysis", icon: Activity, description: "Global health metrics" },
  { id: "food", label: "Food Security", icon: PieChart, description: "Agricultural & supply data" },
  { id: "energy", label: "Energy Grid", icon: Activity, description: "Power & renewable energy" },
  { id: "governance", label: "Governance", icon: Globe, description: "Policy & DAO analytics" },
  { id: "intelligence", label: "Intelligence Hub", icon: Table2, description: "Real-time intel feed" },
];

export const AnalysisDashboard = () => {
  const [selectedVisualizations, setSelectedVisualizations] = useState<VisualizationType[]>([
    "metrics", "predictions", "map"
  ]);
  const [viewMode, setViewMode] = useState<"grid" | "tabs">("grid");

  const toggleVisualization = (id: VisualizationType) => {
    setSelectedVisualizations(prev => 
      prev.includes(id) 
        ? prev.filter(v => v !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedVisualizations(VISUALIZATION_OPTIONS.map(v => v.id));
  };

  const clearAll = () => {
    setSelectedVisualizations([]);
  };

  const renderVisualization = (id: VisualizationType) => {
    switch (id) {
      case "metrics": return <MetricsPanel />;
      case "predictions": return <PredictiveIntelligence />;
      case "sdg": return <SDGDashboard />;
      case "map": return <div className="h-[500px]"><GlobalVulnerabilityMap /></div>;
      case "finance": return <FinancialPanel />;
      case "health": return <HealthcarePanel />;
      case "food": return <FoodSecurityPanel />;
      case "energy": return <EnergyPanel />;
      case "governance": return <UnifiedGovernancePanel />;
      case "intelligence": return <IntelligenceHub />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Analysis Dashboard</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Select visualizations to display
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedVisualizations.length} selected</Badge>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear
              </Button>
              <div className="flex border rounded-md">
                <Button 
                  variant={viewMode === "grid" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-r-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === "tabs" ? "secondary" : "ghost"} 
                  size="sm"
                  onClick={() => setViewMode("tabs")}
                  className="rounded-l-none"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {VISUALIZATION_OPTIONS.map(option => {
              const Icon = option.icon;
              const isSelected = selectedVisualizations.includes(option.id);
              return (
                <div 
                  key={option.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleVisualization(option.id)}
                >
                  <Checkbox 
                    checked={isSelected} 
                    onCheckedChange={() => toggleVisualization(option.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <Label className="text-sm font-medium cursor-pointer truncate">
                        {option.label}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Visualizations */}
      {selectedVisualizations.length === 0 ? (
        <Card className="p-12 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Visualizations Selected</h3>
          <p className="text-muted-foreground mb-4">
            Select one or more visualization types above to display analysis data
          </p>
          <Button onClick={selectAll}>Select All Visualizations</Button>
        </Card>
      ) : viewMode === "tabs" ? (
        <Tabs defaultValue={selectedVisualizations[0]} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {selectedVisualizations.map(id => {
              const option = VISUALIZATION_OPTIONS.find(o => o.id === id);
              if (!option) return null;
              const Icon = option.icon;
              return (
                <TabsTrigger key={id} value={id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {option.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {selectedVisualizations.map(id => (
            <TabsContent key={id} value={id}>
              {renderVisualization(id)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="space-y-6">
          {selectedVisualizations.map(id => {
            const option = VISUALIZATION_OPTIONS.find(o => o.id === id);
            if (!option) return null;
            return (
              <div key={id}>
                {renderVisualization(id)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
