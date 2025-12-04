import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Video, Play, Pause, SkipForward, SkipBack, 
  Volume2, VolumeX, Maximize, Film, Tv, Radio,
  Globe, AlertTriangle, TrendingUp, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VideoFeed {
  id: string;
  title: string;
  type: "live" | "recorded" | "stream";
  source: string;
  category: string;
  status: "active" | "offline" | "pending";
  thumbnail?: string;
  lastUpdated: Date;
}

export const VideoDashboard = () => {
  const [feeds, setFeeds] = useState<VideoFeed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<VideoFeed | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    // Load video feeds from various sources
    const loadFeeds = async () => {
      setLoading(true);
      
      // Fetch crisis events for live feeds
      const { data: crisisData } = await supabase
        .from("crisis_events")
        .select("*")
        .eq("status", "active")
        .limit(10);

      // Fetch security incidents
      const { data: securityData } = await supabase
        .from("security_incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      // Generate feeds from real data
      const generatedFeeds: VideoFeed[] = [
        // Live global feeds
        {
          id: "global-1",
          title: "Global Crisis Monitor",
          type: "live",
          source: "AICIS Central",
          category: "Crisis",
          status: "active",
          lastUpdated: new Date(),
        },
        {
          id: "global-2",
          title: "Real-Time Market Data",
          type: "stream",
          source: "Financial Division",
          category: "Finance",
          status: "active",
          lastUpdated: new Date(),
        },
        {
          id: "global-3",
          title: "Satellite Weather Feed",
          type: "live",
          source: "NASA/NOAA",
          category: "Satellite",
          status: "active",
          lastUpdated: new Date(),
        },
        {
          id: "global-4",
          title: "Health Emergency Network",
          type: "live",
          source: "WHO Integration",
          category: "Health",
          status: "active",
          lastUpdated: new Date(),
        },
        // Add feeds from crisis data
        ...(crisisData || []).map((crisis, idx) => ({
          id: `crisis-${crisis.id}`,
          title: `${crisis.kind} - ${crisis.region}`,
          type: "live" as const,
          source: "Crisis Monitor",
          category: "Crisis",
          status: crisis.status === "active" ? "active" as const : "offline" as const,
          lastUpdated: new Date(crisis.updated_at || crisis.created_at || Date.now()),
        })),
        // Add feeds from security incidents
        ...(securityData || []).slice(0, 5).map((incident) => ({
          id: `security-${incident.id}`,
          title: incident.event_type || "Security Alert",
          type: "stream" as const,
          source: "Security Division",
          category: "Security",
          status: "active" as const,
          lastUpdated: new Date(incident.created_at || Date.now()),
        })),
      ];

      setFeeds(generatedFeeds);
      if (generatedFeeds.length > 0) {
        setSelectedFeed(generatedFeeds[0]);
      }
      setLoading(false);
    };

    loadFeeds();
  }, []);

  const filteredFeeds = activeTab === "all" 
    ? feeds 
    : feeds.filter(f => f.category.toLowerCase() === activeTab || f.type === activeTab);

  const categories = ["all", "live", "crisis", "finance", "health", "security", "satellite"];

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col gap-4">
      {/* Main Video Display */}
      <Card className="flex-1 bg-card/50 backdrop-blur-sm border-primary/20 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Video Header */}
          <div className="p-4 border-b border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Tv className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-orbitron font-bold">
                  {selectedFeed?.title || "Video Feeds"}
                </h2>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  {selectedFeed && (
                    <>
                      <Badge variant={selectedFeed.status === "active" ? "default" : "secondary"} className="text-xs">
                        {selectedFeed.type}
                      </Badge>
                      <span>{selectedFeed.source}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            {selectedFeed?.status === "active" && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs text-destructive font-medium">LIVE</span>
              </div>
            )}
          </div>

          {/* Video Area */}
          <div className="flex-1 relative bg-black/90 flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <span className="text-muted-foreground">Loading feeds...</span>
              </div>
            ) : selectedFeed ? (
              <div className="w-full h-full flex flex-col items-center justify-center relative">
                {/* Simulated video display */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
                
                {/* Data visualization overlay */}
                <div className="relative z-10 text-center space-y-6">
                  <div className="w-32 h-32 mx-auto rounded-full border-4 border-primary/30 flex items-center justify-center animate-pulse">
                    {selectedFeed.category === "Crisis" && <AlertTriangle className="w-16 h-16 text-destructive" />}
                    {selectedFeed.category === "Finance" && <TrendingUp className="w-16 h-16 text-success" />}
                    {selectedFeed.category === "Satellite" && <Globe className="w-16 h-16 text-primary" />}
                    {selectedFeed.category === "Health" && <Radio className="w-16 h-16 text-warning" />}
                    {selectedFeed.category === "Security" && <Film className="w-16 h-16 text-secondary" />}
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-orbitron text-primary">{selectedFeed.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{selectedFeed.source}</p>
                  </div>

                  {/* Live data ticker */}
                  <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 max-w-md mx-auto">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Update</span>
                      <span>{selectedFeed.lastUpdated.toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={selectedFeed.status === "active" ? "default" : "secondary"}>
                        {selectedFeed.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Animated scan lines */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] animate-pulse opacity-20" />
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a feed to view</p>
              </div>
            )}
          </div>

          {/* Video Controls */}
          <div className="p-4 border-t border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled>
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button 
                  variant="default" 
                  size="icon"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" disabled>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon">
                  <Maximize className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Feed Selector */}
      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Available Feeds</CardTitle>
            <Badge variant="outline">{feeds.filter(f => f.status === "active").length} active</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-3 flex flex-wrap h-auto gap-1">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="text-xs capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <ScrollArea className="h-32">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {filteredFeeds.map(feed => (
                <div
                  key={feed.id}
                  className={`p-2 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                    selectedFeed?.id === feed.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedFeed(feed)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      feed.status === "active" ? "bg-success" : "bg-muted"
                    }`} />
                    <span className="text-xs font-medium truncate">{feed.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {feed.source}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
