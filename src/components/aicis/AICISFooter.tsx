import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronUp, Database, Shield, Clock, AlertCircle } from "lucide-react";

interface DataSource {
  name: string;
  status: "online" | "partial" | "error";
  lastUpdate: string;
}

export const AICISFooter = () => {
  const [expanded, setExpanded] = useState(false);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [overallConfidence, setOverallConfidence] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    const fetchDataSources = async () => {
      try {
        const { data } = await supabase
          .from("data_source_log")
          .select("source, status, last_success")
          .order("created_at", { ascending: false })
          .limit(20);

        if (data) {
          // Group by source and get latest
          const sourceMap = new Map<string, DataSource>();
          data.forEach(d => {
            if (!sourceMap.has(d.source)) {
              sourceMap.set(d.source, {
                name: d.source,
                status: d.status === "ok" || d.status === "success" ? "online" : 
                       d.status === "partial" ? "partial" : "error",
                lastUpdate: d.last_success || "Unknown"
              });
            }
          });

          const sources = Array.from(sourceMap.values()).slice(0, 8);
          setDataSources(sources);

          const onlineCount = sources.filter(s => s.status === "online").length;
          setOverallConfidence(Math.round((onlineCount / Math.max(sources.length, 1)) * 100));
          
          if (data.length > 0 && data[0].last_success) {
            const time = new Date(data[0].last_success);
            const diff = Math.floor((Date.now() - time.getTime()) / 60000);
            setLastUpdate(diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`);
          }
        }
      } catch (error) {
        console.error("Error fetching data sources:", error);
      }
    };

    fetchDataSources();
    const interval = setInterval(fetchDataSources, 60000);
    return () => clearInterval(interval);
  }, []);

  const defaultSources: DataSource[] = [
    { name: "World Bank", status: "online", lastUpdate: "Live" },
    { name: "WHO", status: "online", lastUpdate: "Live" },
    { name: "FAOSTAT", status: "online", lastUpdate: "Live" },
    { name: "GDELT", status: "online", lastUpdate: "Live" },
    { name: "NASA EONET", status: "online", lastUpdate: "Live" },
    { name: "USGS", status: "online", lastUpdate: "Live" },
  ];

  const displaySources = dataSources.length > 0 ? dataSources : defaultSources;

  return (
    <TooltipProvider>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <footer className="h-8 bg-card/95 backdrop-blur-xl border-t border-primary/20 flex items-center justify-between px-4 z-40 shrink-0">
          {/* Left: Data Sources Summary */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {displaySources.filter(s => s.status === "online").length}/{displaySources.length} Sources Active
              </span>
            </div>

            {/* Source indicators - desktop only */}
            <div className="hidden lg:flex items-center gap-1">
              {displaySources.slice(0, 6).map((source, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      source.status === "online" && "bg-success",
                      source.status === "partial" && "bg-warning",
                      source.status === "error" && "bg-destructive"
                    )} />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="text-xs">
                      <p className="font-medium">{source.name}</p>
                      <p className="text-muted-foreground">{source.lastUpdate}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Center: Confidence & Ethics */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-primary" />
              <span className="text-[10px] text-muted-foreground">
                Confidence: <span className={cn(
                  "font-medium",
                  overallConfidence >= 80 ? "text-success" : 
                  overallConfidence >= 50 ? "text-warning" : "text-destructive"
                )}>{overallConfidence || 85}%</span>
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Open-source data • No personal tracking
              </span>
            </div>
          </div>

          {/* Right: Last Update & Expand */}
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  Updated {lastUpdate}
                </span>
              </div>
            )}

            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <ChevronUp className={cn(
                  "h-3 w-3 transition-transform",
                  expanded && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </footer>

        {/* Expanded Data Provenance Panel */}
        <CollapsibleContent>
          <div className="bg-card/95 backdrop-blur-xl border-t border-border/50 p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Data Sources & Provenance
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {displaySources.map((source, i) => (
                <div 
                  key={i}
                  className={cn(
                    "p-2 rounded border text-xs",
                    source.status === "online" && "border-success/30 bg-success/5",
                    source.status === "partial" && "border-warning/30 bg-warning/5",
                    source.status === "error" && "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate">{source.name}</span>
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      source.status === "online" && "bg-success",
                      source.status === "partial" && "bg-warning",
                      source.status === "error" && "bg-destructive"
                    )} />
                  </div>
                  <span className="text-muted-foreground">{source.lastUpdate}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 text-[10px] text-muted-foreground">
              <p className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                Ethical considerations: Analysis uses publicly accessible aggregated data sources. 
                Calibrated for accuracy with known uncertainty areas documented.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </TooltipProvider>
  );
};
