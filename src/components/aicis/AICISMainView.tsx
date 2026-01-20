import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  IntelligenceQueryBar, 
  type IntelligenceResult 
} from "./IntelligenceQueryBar";
import { IntelligenceAssessment } from "./IntelligenceAssessment";
import { SecurityConflictView } from "./SecurityConflictView";
import { LiveCriticalAlerts } from "./LiveCriticalAlerts";
import { GlobalMap, GlobalMapRef } from "@/components/command-center/GlobalMap";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Globe, Swords, Bell, Map 
} from "lucide-react";

export const AICISMainView = () => {
  const isMobile = useIsMobile();
  const mapRef = useRef<GlobalMapRef>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [queryResult, setQueryResult] = useState<IntelligenceResult | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<{
    name: string;
    iso3: string;
    lat?: number;
    lng?: number;
  } | null>(null);

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

  return (
    <div className="h-full flex flex-col p-4 md:p-6 space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            <div className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse" />
            Data Feeds Online
          </Badge>
          
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <Bell className="h-3 w-3 mr-1" />
            4 Critical Alerts Active
          </Badge>
        </div>
        
        <Badge variant="secondary" className="text-xs">
          Last updated: 5 minutes ago
        </Badge>
      </div>

      {/* Intelligence Query Bar */}
      <IntelligenceQueryBar 
        onQueryResult={handleQueryResult}
        className="mb-2"
      />

      {/* Main Content Tabs */}
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

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="flex-1 mt-4 overflow-auto">
          <LiveCriticalAlerts maxHeight="600px" />
        </TabsContent>
      </Tabs>
    </div>
  );
};
