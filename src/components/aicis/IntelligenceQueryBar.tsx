import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Mic, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface IntelligenceQueryBarProps {
  onQueryResult: (result: IntelligenceResult) => void;
  className?: string;
}

export interface IntelligenceResult {
  query: string;
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  lastUpdated: string;
  divisions: string[];
  dashboards: DashboardCard[];
  sources: string[];
  location?: {
    name: string;
    iso3?: string;
    lat?: number;
    lng?: number;
  };
}

export interface DashboardCard {
  id: string;
  title: string;
  value: string | number;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  source?: string;
  division: string;
}

const exampleQueries = [
  "Governance risks in Nauru",
  "Killings and conflict hotspots worldwide",
  "Food security outlook for Northern Nigeria",
  "Compare energy resilience: Germany vs France",
  "Global terrorist activity trends this month",
];

export const IntelligenceQueryBar = ({ onQueryResult, className }: IntelligenceQueryBarProps) => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const handleSubmit = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("aicis-intelligence", {
        body: { query: queryText }
      });

      if (error) throw error;

      // Transform the response into our format
      const result: IntelligenceResult = {
        query: queryText,
        summary: data.briefing || data.summary || "Analysis complete.",
        severity: data.severity || "medium",
        confidence: data.confidence || 75,
        lastUpdated: new Date().toISOString(),
        divisions: data.divisions || [],
        dashboards: data.dashboards || [],
        sources: data.sources || ["AICIS Core Intelligence"],
        location: data.location
      };

      onQueryResult(result);
      toast.success("Intelligence assessment generated");
    } catch (error: any) {
      console.error("Query error:", error);
      toast.error("Failed to process query. Please try again.");
      
      // Return a fallback result
      onQueryResult({
        query: queryText,
        summary: "Unable to process query. Please check connectivity and try again.",
        severity: "low",
        confidence: 0,
        lastUpdated: new Date().toISOString(),
        divisions: [],
        dashboards: [],
        sources: []
      });
    } finally {
      setIsLoading(false);
    }
  }, [onQueryResult]);

  const handleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      toast.error("Voice recognition not supported in this browser");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      handleSubmit(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Voice recognition failed");
    };

    recognition.start();
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main Query Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        
        <Input
          type="text"
          placeholder="Ask AICIS about any country, city, region, or global issue..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit(query)}
          className="h-14 pl-12 pr-28 text-base bg-muted/50 border-primary/30 focus:border-primary placeholder:text-muted-foreground/60"
          disabled={isLoading}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10",
              isListening && "bg-destructive/20 text-destructive animate-pulse"
            )}
            onClick={handleVoice}
            disabled={isLoading}
          >
            <Mic className="h-5 w-5" />
          </Button>
          
          <Button
            onClick={() => handleSubmit(query)}
            disabled={isLoading || !query.trim()}
            className="h-10 px-4 gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Analyze</span>
          </Button>
        </div>
      </div>

      {/* Example Queries */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground">Examples:</span>
        {exampleQueries.map((example, i) => (
          <Badge
            key={i}
            variant="outline"
            className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-colors"
            onClick={() => {
              setQuery(example);
              handleSubmit(example);
            }}
          >
            {example}
          </Badge>
        ))}
      </div>
    </div>
  );
};
