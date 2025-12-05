import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, Mic, Sparkles, ChevronUp, ChevronDown, 
  Globe, AlertTriangle, BarChart3, X, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { searchCountries, type Country } from "@/lib/geo/all-countries";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface CommandBarProps {
  onCountrySelect?: (country: Country) => void;
  onNavigate?: (view: string) => void;
  className?: string;
}

export const CommandBar = ({ onCountrySelect, onNavigate, className }: CommandBarProps) => {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Country[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.length > 1) {
      const results = searchCountries(value);
      setSuggestions(results.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const processCommand = async (command: string): Promise<string> => {
    const cmd = command.toLowerCase();
    
    try {
      // Quick navigation commands
      if (cmd === "alerts" || cmd === "crisis") {
        onNavigate?.("alerts");
        return "Opening alerts panel...";
      }
      if (cmd === "analytics" || cmd === "data") {
        onNavigate?.("analytics");
        return "Opening analytics dashboard...";
      }
      if (cmd === "map" || cmd === "globe") {
        onNavigate?.("map");
        return "Centering map view...";
      }

      // Country search
      const countries = searchCountries(cmd);
      if (countries.length > 0) {
        onCountrySelect?.(countries[0]);
        return `Found ${countries[0].name}. Navigating to location...`;
      }

      // API queries
      if (cmd.includes("status") || cmd.includes("global")) {
        const { data } = await supabase.functions.invoke("analyze-global-status");
        return data?.analysis?.substring(0, 300) || "Global systems operational.";
      }

      if (cmd.includes("health")) {
        const { data } = await supabase.functions.invoke("analyze-health");
        return data?.analysis?.substring(0, 300) || "Health data analyzed.";
      }

      if (cmd.includes("crisis") || cmd.includes("alert")) {
        const { data } = await supabase.functions.invoke("crisis-scan");
        return `${data?.active_count || 0} active crises detected. ${data?.message || ''}`;
      }

      // Default AI query
      const { data } = await supabase.functions.invoke("aicis-query", {
        body: { query: command }
      });
      return data?.response || "Command processed.";

    } catch (error: any) {
      return `Error: ${error.message || "Failed to process"}`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSuggestions([]);
    setIsExpanded(true);
    setIsProcessing(true);

    const loadingMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      const response = await processCommand(input);
      setMessages(prev =>
        prev.map(m => m.isLoading ? { ...m, content: response, isLoading: false } : m)
      );
    } catch {
      setMessages(prev =>
        prev.map(m => m.isLoading ? { ...m, content: "Error processing request.", isLoading: false } : m)
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCountry = (country: Country) => {
    onCountrySelect?.(country);
    setSuggestions([]);
    setInput("");
  };

  const quickCommands = [
    { label: "Global Status", icon: Globe, cmd: "global status" },
    { label: "Crisis Alerts", icon: AlertTriangle, cmd: "crisis alerts" },
    { label: "Analytics", icon: BarChart3, cmd: "analytics" },
  ];

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300",
      isExpanded ? "h-80" : "h-auto",
      className
    )}>
      {/* Expanded chat history */}
      {isExpanded && messages.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-x border-primary/20 rounded-t-xl max-h-64 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">Command History</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => setIsExpanded(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="h-56 p-4" ref={scrollRef}>
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2 text-sm",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn(
                    "max-w-[85%] px-3 py-2 rounded-lg",
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/50 border border-border/50"
                  )}>
                    {msg.isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-muted-foreground">Processing...</span>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Country suggestions dropdown */}
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mx-4 mb-2 bg-card/95 backdrop-blur-xl border border-primary/20 rounded-lg overflow-hidden animate-fade-in">
          {suggestions.map((country) => (
            <button
              key={country.iso3}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
              onClick={() => handleSelectCountry(country)}
            >
              <Globe className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{country.name}</div>
                <div className="text-xs text-muted-foreground">{country.region} • {country.iso3}</div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{country.iso2}</Badge>
            </button>
          ))}
        </div>
      )}

      {/* Main command bar */}
      <div className="bg-card/95 backdrop-blur-xl border-t border-primary/20 shadow-2xl">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Expand toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>

            {/* Input */}
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Search countries, run commands, or ask anything... (⌘K)"
                className="pl-10 pr-4 h-10 bg-muted/30 border-primary/20 focus:border-primary/50"
                disabled={isProcessing}
              />
            </div>

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="h-10 px-4"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>

            {/* Voice button */}
            <Button variant="outline" size="icon" className="h-10 w-10">
              <Mic className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick commands */}
          <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
            {quickCommands.map(({ label, icon: Icon, cmd }) => (
              <Button
                key={cmd}
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 shrink-0"
                onClick={() => {
                  setInput(cmd);
                  handleSend();
                }}
              >
                <Icon className="h-3 w-3" />
                {label}
              </Button>
            ))}
            <div className="h-4 w-px bg-border mx-1" />
            <span className="text-[10px] text-muted-foreground">
              Try: "Kenya", "health analysis", "show alerts"
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
