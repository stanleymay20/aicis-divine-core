import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Mic, Bot, User, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export const ChatDashboard = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "system",
      content: "AICIS Intelligence System online. I can help you analyze global data, search for countries, generate reports, and provide real-time insights. What would you like to explore?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const processCommand = async (command: string): Promise<string> => {
    const cmd = command.toLowerCase();

    try {
      // Country search
      if (cmd.includes("search") || cmd.includes("find") || cmd.includes("show")) {
        const countryMatch = cmd.match(/(?:search|find|show|data for|info on)\s+(.+)/i);
        if (countryMatch) {
          const query = countryMatch[1].trim();
          const { data } = await supabase
            .from("country_profiles")
            .select("*")
            .ilike("country_name", `%${query}%`)
            .limit(5);

          if (data && data.length > 0) {
            return `Found ${data.length} result(s):\n\n${data.map(c => 
              `🌍 **${c.country_name}** (${c.iso3})\nConfidence: ${c.confidence || 'N/A'}%\nLast Updated: ${new Date(c.updated_at || '').toLocaleDateString()}`
            ).join('\n\n')}`;
          }
          return `No country data found for "${query}". Try searching with a different name or ISO code.`;
        }
      }

      // Financial analysis
      if (cmd.includes("financial") || cmd.includes("revenue") || cmd.includes("economic")) {
        const { data, error } = await supabase.functions.invoke("analyze-revenue");
        if (error) throw error;
        return `📊 **Financial Analysis**\n\n${data.analysis}\n\n💰 Total Revenue: $${data.metrics?.total_revenue?.toLocaleString() || 'N/A'}`;
      }

      // Health analysis
      if (cmd.includes("health") || cmd.includes("disease") || cmd.includes("medical")) {
        const { data, error } = await supabase.functions.invoke("analyze-health");
        if (error) throw error;
        return `🏥 **Health Analysis**\n\n${data.analysis}\n\n📊 Total Cases: ${data.metrics?.total_cases?.toLocaleString() || 'N/A'}`;
      }

      // Crisis scan
      if (cmd.includes("crisis") || cmd.includes("emergency") || cmd.includes("alert")) {
        const { data, error } = await supabase.functions.invoke("crisis-scan");
        if (error) throw error;
        return `🚨 **Crisis Scan**\n\n${data.message}\n\n${data.escalations?.length > 0 ? `⚠️ ${data.escalations.length} events require attention` : '✅ All events under control'}`;
      }

      // Global status
      if (cmd.includes("global") || cmd.includes("status") || cmd.includes("overview")) {
        const { data, error } = await supabase.functions.invoke("analyze-global-status");
        if (error) throw error;
        return `🌐 **Global Status**\n\n${data.analysis?.substring(0, 500) || data.message}...`;
      }

      // SDG Progress
      if (cmd.includes("sdg") || cmd.includes("sustainable") || cmd.includes("goals")) {
        const { data, error } = await supabase.from("sdg_progress").select("*").order("goal");
        if (error) throw error;
        const avgProgress = data?.reduce((sum, g) => sum + Number(g.progress_percent || 0), 0) / (data?.length || 1);
        return `🎯 **UN SDG Progress**\n\nAverage Progress: ${avgProgress.toFixed(1)}%\n\n${data?.slice(0, 5).map(g => 
          `Goal ${g.goal}: ${g.progress_percent}%`
        ).join('\n')}`;
      }

      // Vulnerability data
      if (cmd.includes("vulnerability") || cmd.includes("risk")) {
        const { data } = await supabase
          .from("vulnerability_scores")
          .select("*")
          .order("overall_score", { ascending: false })
          .limit(5);

        if (data && data.length > 0) {
          return `⚠️ **Top Vulnerability Risks**\n\n${data.map(v => 
            `🔴 ${v.country}: ${v.overall_score?.toFixed(1) || 'N/A'}/100`
          ).join('\n')}`;
        }
        return "No vulnerability data available.";
      }

      // Default AI query
      const { data, error } = await supabase.functions.invoke("aicis-query", {
        body: { query: command },
      });
      if (error) throw error;
      return data.response || data.message || "Query processed successfully.";

    } catch (error: any) {
      console.error("Command error:", error);
      return `⚠️ Error: ${error.message || "Failed to process command"}`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput("");
    setIsProcessing(true);

    try {
      const response = await processCommand(input);
      
      setMessages(prev => 
        prev.map(m => 
          m.isLoading 
            ? { ...m, content: response, isLoading: false }
            : m
        )
      );
    } catch (error) {
      setMessages(prev => 
        prev.map(m => 
          m.isLoading 
            ? { ...m, content: "Sorry, I encountered an error processing your request.", isLoading: false }
            : m
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      <Card className="flex-1 flex flex-col bg-card/50 backdrop-blur-sm border-primary/20 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-primary/20 flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary rounded-full blur-lg opacity-50 animate-pulse" />
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h2 className="font-orbitron font-bold text-lg">AICIS Intelligence</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Online • Real-time Analysis
            </p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                {message.role !== "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    {message.isLoading ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-primary" />
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border"
                  }`}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Analyzing...</span>
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  )}
                  <div className="text-xs opacity-50 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-secondary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-primary/20">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about countries, data, crises, or global intelligence..."
              className="flex-1 bg-background/50"
              disabled={isProcessing}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="px-4"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
            <Button variant="outline" size="icon">
              <Mic className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {["Show global status", "Search Kenya", "Crisis alerts", "SDG progress"].map((suggestion) => (
              <Button
                key={suggestion}
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setInput(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
