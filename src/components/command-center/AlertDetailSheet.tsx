import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertTriangle, MapPin, Clock, Send, Loader2,
  Shield, Activity, Brain, Globe, Target, Users,
  MessageSquare, ChevronRight, Zap, Radio, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
  division: string;
  country?: string;
  created_at: string;
  acknowledged: boolean;
}

interface RelatedIntel {
  id: string;
  title: string;
  type: string;
  source: string;
  timestamp: string;
}

interface AlertDetailSheetProps {
  alert: Alert | null;
  onClose: () => void;
  onNavigateToLocation?: (country: string) => void;
}

export const AlertDetailSheet = ({ alert, onClose, onNavigateToLocation }: AlertDetailSheetProps) => {
  const [query, setQuery] = useState("");
  const [isProbing, setIsProbing] = useState(false);
  const [probeResponse, setProbeResponse] = useState<string | null>(null);
  const [relatedIntel, setRelatedIntel] = useState<RelatedIntel[]>([]);
  const [isLoadingIntel, setIsLoadingIntel] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  useEffect(() => {
    if (alert) {
      fetchRelatedIntel();
      setProbeResponse(null);
      setQuery("");
    }
  }, [alert?.id]);

  const fetchRelatedIntel = async () => {
    if (!alert) return;
    setIsLoadingIntel(true);

    try {
      const queries = [];
      
      // Fetch related intel events
      if (alert.country) {
        queries.push(
          supabase
            .from("intel_events")
            .select("id, title, event_type, division, published_at")
            .or(`description.ilike.%${alert.country}%,title.ilike.%${alert.country}%`)
            .order("published_at", { ascending: false })
            .limit(5)
        );
      }
      
      // Fetch related crisis events
      queries.push(
        supabase
          .from("crisis_events")
          .select("id, kind, region, severity, opened_at")
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(3)
      );

      // Fetch related security incidents
      if (alert.country) {
        queries.push(
          supabase
            .from("security_incidents")
            .select("id, event_type, summary, source, detected_at")
            .ilike("country", `%${alert.country}%`)
            .order("detected_at", { ascending: false })
            .limit(3)
        );
      }

      const results = await Promise.all(queries);
      
      const intel: RelatedIntel[] = [];
      
      // Process intel events
      if (results[0]?.data) {
        results[0].data.forEach((item: any) => {
          intel.push({
            id: item.id,
            title: item.title,
            type: item.event_type || "intel",
            source: item.division || "AICIS",
            timestamp: item.published_at,
          });
        });
      }

      // Process crisis events
      const crisisIndex = alert.country ? 1 : 0;
      if (results[crisisIndex]?.data) {
        results[crisisIndex].data.forEach((item: any) => {
          intel.push({
            id: item.id,
            title: `${item.kind} in ${item.region}`,
            type: "crisis",
            source: "Crisis Monitor",
            timestamp: item.opened_at,
          });
        });
      }

      // Process security incidents
      if (alert.country && results[2]?.data) {
        results[2].data.forEach((item: any) => {
          intel.push({
            id: item.id,
            title: item.summary?.substring(0, 60) || item.event_type,
            type: "security",
            source: item.source || "Security",
            timestamp: item.detected_at,
          });
        });
      }

      setRelatedIntel(intel.slice(0, 8));
    } catch (error) {
      console.error("Error fetching related intel:", error);
    } finally {
      setIsLoadingIntel(false);
    }
  };

  const handleProbe = async () => {
    if (!query.trim() || !alert) return;
    
    setIsProbing(true);
    setAnalysisProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + 15, 90));
    }, 300);

    try {
      const { data, error } = await supabase.functions.invoke("aicis-intelligence", {
        body: {
          query: `Regarding the alert "${alert.title}" in ${alert.country || "global"}: ${query}`,
          context: {
            alertId: alert.id,
            division: alert.division,
            severity: alert.severity,
            originalMessage: alert.message,
          }
        }
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (error) throw error;
      setProbeResponse(data?.response || "No additional intelligence available.");
    } catch (error: any) {
      clearInterval(progressInterval);
      setProbeResponse(`Error: ${error.message || "Failed to probe"}`);
    } finally {
      setIsProbing(false);
      setTimeout(() => setAnalysisProgress(0), 500);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-destructive text-destructive-foreground";
      case "high": return "bg-warning text-warning-foreground";
      case "medium": return "bg-primary text-primary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString();
  };

  if (!alert) return null;

  return (
    <Sheet open={!!alert} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col h-full">
        <SheetHeader className="p-4 border-b border-border shrink-0">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg shrink-0", getSeverityColor(alert.severity))}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left line-clamp-2 font-orbitron">
                {alert.title}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {alert.division}
                </Badge>
                <Badge className={cn("text-xs", getSeverityColor(alert.severity))}>
                  {alert.severity}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Alert details */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{alert.message}</p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(alert.created_at)}
                </span>
                {alert.country && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={() => onNavigateToLocation?.(alert.country!)}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {alert.country}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2"
                onClick={() => onNavigateToLocation?.(alert.country || "")}
              >
                <Globe className="h-4 w-4" />
                View on Map
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2"
              >
                <Eye className="h-4 w-4" />
                Satellite View
              </Button>
            </div>

            {/* Related Intelligence */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-sm">Related Intelligence</h3>
              </div>
              
              {isLoadingIntel ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : relatedIntel.length > 0 ? (
                <div className="space-y-2">
                  {relatedIntel.map((intel) => (
                    <div
                      key={intel.id}
                      className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{intel.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {intel.type}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {intel.source}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No related intelligence found
                </div>
              )}
            </div>

            {/* AI Probe Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-sm">AI Ground Intelligence Probe</h3>
              </div>
              
              <div className="space-y-2">
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask for deeper analysis... e.g., 'What are the humanitarian implications?' or 'What actions are recommended?'"
                  className="min-h-[80px] text-sm resize-none"
                  disabled={isProbing}
                />
                
                {analysisProgress > 0 && (
                  <div className="space-y-1">
                    <Progress value={analysisProgress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">
                      Analyzing ground intelligence...
                    </p>
                  </div>
                )}
                
                <Button
                  onClick={handleProbe}
                  disabled={!query.trim() || isProbing}
                  className="w-full gap-2"
                >
                  {isProbing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Probing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Probe Intelligence
                    </>
                  )}
                </Button>
              </div>

              {probeResponse && (
                <div className="p-4 rounded-lg bg-muted/50 border border-primary/20 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-primary">AI Analysis</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{probeResponse}</p>
                </div>
              )}
            </div>

            {/* Suggested probes */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Suggested probes:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "What's the current ground situation?",
                  "Recommended response actions?",
                  "Historical context?",
                  "Related incidents nearby?",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs bg-muted/30"
                    onClick={() => setQuery(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
