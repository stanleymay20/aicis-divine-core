import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  BarChart3, LineChart, PieChart, Activity, Map, Table2, 
  TrendingUp, Globe, Target, Filter, LayoutGrid, Zap, Heart,
  Apple, Building, Shield, AlertTriangle, Cpu
} from "lucide-react";
import { MetricsPanel } from "@/components/MetricsPanel";
import { PredictiveIntelligence } from "@/components/PredictiveIntelligence";
import SDGDashboard from "@/components/SDGDashboard";
import { GlobalVulnerabilityMap } from "@/components/GlobalVulnerabilityMap";
import { FinancialPanel } from "@/components/FinancialPanel";
import { HealthcarePanel } from "@/components/HealthcarePanel";
import { FoodSecurityPanel } from "@/components/FoodSecurityPanel";
import { EnergyPanel } from "@/components/EnergyPanel";
import { UnifiedGovernancePanel } from "@/components/UnifiedGovernancePanel";
import { IntelligenceHub } from "@/components/IntelligenceHub";
import { CrisisPanel } from "@/components/CrisisPanel";
import { DefensePanel } from "@/components/DefensePanel";
import { SystemStatus } from "@/components/SystemStatus";
import EconomyPanel from "@/components/EconomyPanel";

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
  | "intelligence"
  | "crisis"
  | "defense"
  | "system"
  | "economy";

interface VisualizationOption {
  id: VisualizationType;
  label: string;
  icon: React.ElementType;
  description: string;
  category: string;
}

const VISUALIZATION_OPTIONS: VisualizationOption[] = [
  { id: "system", label: "System Status", icon: Cpu, description: "Real-time system health", category: "Core" },
  { id: "metrics", label: "Metrics", icon: BarChart3, description: "Revenue & operations", category: "Core" },
  { id: "predictions", label: "Predictions", icon: TrendingUp, description: "AI-driven forecasts", category: "Core" },
  { id: "intelligence", label: "Intelligence", icon: Table2, description: "Real-time intel feed", category: "Core" },
  { id: "map", label: "Global Map", icon: Map, description: "Vulnerability mapping", category: "Geographic" },
  { id: "sdg", label: "SDG Progress", icon: Target, description: "UN Goals tracking", category: "Global" },
  { id: "economy", label: "Economy", icon: LineChart, description: "Economic indicators", category: "Sectors" },
  { id: "finance", label: "Financial", icon: LineChart, description: "Market & trading", category: "Sectors" },
  { id: "health", label: "Healthcare", icon: Heart, description: "Health metrics", category: "Sectors" },
  { id: "food", label: "Food Security", icon: Apple, description: "Agricultural data", category: "Sectors" },
  { id: "energy", label: "Energy", icon: Zap, description: "Power grid status", category: "Sectors" },
  { id: "governance", label: "Governance", icon: Building, description: "Policy & DAO", category: "Sectors" },
  { id: "crisis", label: "Crisis", icon: AlertTriangle, description: "Active crises", category: "Security" },
  { id: "defense", label: "Defense", icon: Shield, description: "Security posture", category: "Security" },
];

const CATEGORIES = ["Core", "Geographic", "Global", "Sectors", "Security"];

export const VisualizationDashboard = () => {
  const [selectedVisualizations, setSelectedVisualizations] = useState<VisualizationType[]>(
    VISUALIZATION_OPTIONS.map(v => v.id)
  );
  const [viewMode, setViewMode] = useState<"grid" | "tabs">("grid");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const selectCategory = (category: string) => {
    const categoryItems = VISUALIZATION_OPTIONS.filter(v => v.category === category).map(v => v.id);
    const allSelected = categoryItems.every(id => selectedVisualizations.includes(id));
    
    if (allSelected) {
      setSelectedVisualizations(prev => prev.filter(id => !categoryItems.includes(id)));
    } else {
      setSelectedVisualizations(prev => [...new Set([...prev, ...categoryItems])]);
    }
  };

  const renderVisualization = (id: VisualizationType) => {
    switch (id) {
      case "system": return <SystemStatus />;
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
      case "crisis": return <CrisisPanel />;
      case "defense": return <DefensePanel />;
      case "economy": return <EconomyPanel />;
      default: return null;
    }
  };

  const filteredOptions = activeCategory 
    ? VISUALIZATION_OPTIONS.filter(v => v.category === activeCategory)
    : VISUALIZATION_OPTIONS;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <LayoutGrid className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="font-orbitron">Visualization Dashboard</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Select and arrange all visualization types
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-primary">
                {selectedVisualizations.length}/{VISUALIZATION_OPTIONS.length} selected
              </Badge>
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
          {/* Category Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button 
              variant={activeCategory === null ? "default" : "outline"} 
              size="sm"
              onClick={() => setActiveCategory(null)}
            >
              All
            </Button>
            {CATEGORIES.map(cat => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* Visualization Options */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {filteredOptions.map(option => {
              const Icon = option.icon;
              const isSelected = selectedVisualizations.includes(option.id);
              return (
                <div 
                  key={option.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                    isSelected 
                      ? "border-primary bg-primary/10 shadow-sm shadow-primary/20" 
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleVisualization(option.id)}
                >
                  <Checkbox 
                    checked={isSelected} 
                    onCheckedChange={() => toggleVisualization(option.id)}
                    className="shrink-0"
                  />
                  <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-medium truncate">{option.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Visualizations */}
      {selectedVisualizations.length === 0 ? (
        <Card className="p-12 text-center animate-fade-in">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Visualizations Selected</h3>
          <p className="text-muted-foreground mb-4">
            Select one or more visualization types above to display
          </p>
          <Button onClick={selectAll}>Select All Visualizations</Button>
        </Card>
      ) : viewMode === "tabs" ? (
        <Tabs defaultValue={selectedVisualizations[0]} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {selectedVisualizations.map(id => {
              const option = VISUALIZATION_OPTIONS.find(o => o.id === id);
              if (!option) return null;
              const Icon = option.icon;
              return (
                <TabsTrigger key={id} value={id} className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Icon className="h-4 w-4" />
                  {option.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {selectedVisualizations.map(id => (
            <TabsContent key={id} value={id} className="animate-fade-in">
              {renderVisualization(id)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="space-y-6">
          {selectedVisualizations.map((id, index) => {
            const option = VISUALIZATION_OPTIONS.find(o => o.id === id);
            if (!option) return null;
            return (
              <div 
                key={id} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {renderVisualization(id)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
