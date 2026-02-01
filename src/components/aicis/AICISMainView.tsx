import { useState, useRef, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  IntelligenceQueryBar, 
  type IntelligenceResult 
} from "./IntelligenceQueryBar";
import { IntelligenceAssessment } from "./IntelligenceAssessment";
import { SecurityConflictView } from "./SecurityConflictView";
import { LiveCriticalAlerts } from "./LiveCriticalAlerts";
import { ExecutiveIntelligenceMode } from "./ExecutiveIntelligenceMode";
import { AnomalyDetection } from "./AnomalyDetection";
import { SmallNationGuidance, generateNationGuidance } from "./SmallNationGuidance";
import { CountryQuickAccess } from "./CountryQuickAccess";
import { GlobalMap, GlobalMapRef } from "@/components/command-center/GlobalMap";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { 
  LayoutDashboard, Globe, Swords, Bell, Map, Shield, Zap, Activity, Lightbulb 
} from "lucide-react";

export const AICISMainView = () => {
  const isMobile = useIsMobile();
  const mapRef = useRef<GlobalMapRef>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [executiveMode, setExecutiveMode] = useState(false);
  const [queryResult, setQueryResult] = useState<IntelligenceResult | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<{
    name: string;
    iso3: string;
    lat?: number;
    lng?: number;
  } | null>(null);
  
  // Live status indicators from database
  const [dataFeedStatus, setDataFeedStatus] = useState<"online" | "partial" | "offline">("online");
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  // Fetch live status from database
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Check data feed status
        const { data: logs, error: logsError } = await supabase
          .from("data_source_log")
          .select("status")
          .order("created_at", { ascending: false })
          .limit(10);
        
        if (!logsError && logs) {
          const failedCount = logs.filter(l => l.status === "error" || l.status === "failed").length;
          if (failedCount === 0) setDataFeedStatus("online");
          else if (failedCount < 5) setDataFeedStatus("partial");
          else setDataFeedStatus("offline");
        }

        // Get critical alert count
        const { count } = await supabase
          .from("critical_alerts")
          .select("*", { count: "exact", head: true })
          .eq("acknowledged", false);
        
        setCriticalAlertCount(count || 0);
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Status fetch error:", error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel("status-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "critical_alerts" }, fetchStatus)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleQueryResult = useCallback((result: IntelligenceResult) => {
    setQueryResult(result);
    
    // If result has location, navigate map
    if (result.location?.lat && result.location?.lng) {
      mapRef.current?.getMap()?.flyTo({
        center: [result.location.lng, result.location.lat],
        zoom: 6,
        duration: 2000
      });
      setSelectedCountry({
        name: result.location.name,
        iso3: result.location.iso3 || "",
        lat: result.location.lat,
        lng: result.location.lng
      });
    }
  }, []);

  const handleMapCountrySelect = useCallback((data: { country: string; iso3: string }) => {
    setSelectedCountry({
      name: data.country,
      iso3: data.iso3
    });
  }, []);

  const handleLocationClick = useCallback((location: { name: string; iso3?: string; lat?: number; lng?: number }) => {
    if (location.lat && location.lng) {
      mapRef.current?.getMap()?.flyTo({
        center: [location.lng, location.lat],
        zoom: 6,
        duration: 2000
      });
    }
    setActiveTab("map");
  }, []);

  const formatLastUpdated = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff} minutes ago`;
    return `${Math.floor(diff / 60)} hours ago`;
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 space-y-4">
      {/* Status Bar - LIVE from database */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn(
            "border",
            dataFeedStatus === "online" && "bg-success/10 text-success border-success/30",
            dataFeedStatus === "partial" && "bg-warning/10 text-warning border-warning/30",
            dataFeedStatus === "offline" && "bg-destructive/10 text-destructive border-destructive/30"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full mr-1.5",
              dataFeedStatus === "online" && "bg-success animate-pulse",
              dataFeedStatus === "partial" && "bg-warning animate-pulse",
              dataFeedStatus === "offline" && "bg-destructive"
            )} />
            {dataFeedStatus === "online" ? "Data Feeds Online" : 
             dataFeedStatus === "partial" ? "Partial Coverage" : "Feeds Offline"}
          </Badge>
          
          {criticalAlertCount > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 animate-pulse">
              <Bell className="h-3 w-3 mr-1" />
              {criticalAlertCount} Critical Alert{criticalAlertCount !== 1 ? 's' : ''} Active
            </Badge>
          )}

          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Shield className="h-3 w-3 mr-1" />
            AICIS Active
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <CountryQuickAccess triggerClassName="h-7 text-xs" />
          <Button
            variant={executiveMode ? "default" : "outline"}
            size="sm"
            onClick={() => setExecutiveMode(!executiveMode)}
            className="h-7 text-xs gap-1"
          >
            <Zap className="h-3 w-3" />
            {executiveMode ? "Exit Executive" : "Executive Mode"}
          </Button>
          <Badge variant="secondary" className="text-xs">
            {formatLastUpdated(lastUpdated)}
          </Badge>
        </div>
      </div>

      {/* Executive Mode Toggle */}
      {executiveMode && (
        <ExecutiveIntelligenceMode />
      )}

      {/* Intelligence Query Bar */}
      <IntelligenceQueryBar 
        onQueryResult={handleQueryResult}
        className="mb-2"
      />

      {/* Main Content Tabs (hidden when in Executive Mode) */}
      {!executiveMode && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start bg-muted/30 p-1 h-auto flex-wrap">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary/20">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2 data-[state=active]:bg-primary/20">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Global Map</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-destructive/20">
            <Swords className="h-4 w-4" />
            <span className="hidden sm:inline">Security & Conflict</span>
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2 data-[state=active]:bg-primary/20">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Anomalies</span>
          </TabsTrigger>
          <TabsTrigger value="guidance" className="gap-2 data-[state=active]:bg-success/20">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Guidance</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 data-[state=active]:bg-warning/20">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 mt-4 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Intelligence View */}
            <div className="lg:col-span-2 space-y-6">
              {queryResult ? (
                <IntelligenceAssessment 
                  result={queryResult}
                  onLocationClick={handleLocationClick}
                />
              ) : (
                <Card className="p-8 text-center border-dashed">
                  <Map className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Ask AICIS Anything</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Enter a query above to generate dynamic intelligence assessments 
                    for any country, city, region, or global issue.
                  </p>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <LiveCriticalAlerts maxHeight="300px" />
              
              {selectedCountry && (
                <Card className="p-4 border-primary/30">
                  <h4 className="text-sm font-semibold mb-2">Selected Location</h4>
                  <p className="text-lg font-orbitron">{selectedCountry.name}</p>
                  <Badge variant="outline" className="mt-2">{selectedCountry.iso3}</Badge>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Global Map Tab */}
        <TabsContent value="map" className="flex-1 mt-4 min-h-[400px]">
          <div className="h-full rounded-lg overflow-hidden border border-border">
            <GlobalMap
              ref={mapRef}
              onCountrySelect={handleMapCountrySelect}
              className="w-full h-full min-h-[400px]"
              isMobile={isMobile}
            />
          </div>
        </TabsContent>

        {/* Security & Conflict Tab */}
        <TabsContent value="security" className="flex-1 mt-4 overflow-auto">
          <SecurityConflictView />
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="flex-1 mt-4 overflow-auto">
          <AnomalyDetection />
        </TabsContent>

        {/* Guidance Tab */}
        <TabsContent value="guidance" className="flex-1 mt-4 overflow-auto">
          {queryResult?.location ? (
            <SmallNationGuidance
              countryName={queryResult.location.name}
              iso3={queryResult.location.iso3}
              dataCompleteness={(queryResult as any).dataCompleteness || 0.5}
              vulnerabilityScore={
                queryResult.dashboards.find(d => d.title.includes("Vulnerability"))
                  ? parseInt(queryResult.dashboards.find(d => d.title.includes("Vulnerability"))?.value?.toString() || "0")
                  : undefined
              }
              guidance={(queryResult as any).guidance || generateNationGuidance({}, {}, [], [])}
              sources={queryResult.sources}
              lastUpdated={queryResult.lastUpdated}
            />
          ) : (
            <Card className="p-8 text-center border-dashed">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Strategic Guidance</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Query a specific country or region above to receive tailored 
                strategic guidance and actionable recommendations.
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="flex-1 mt-4 overflow-auto">
          <LiveCriticalAlerts maxHeight="600px" />
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
};
