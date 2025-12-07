import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, BarChart3, LogOut, Activity, Settings, HelpCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { LiveTicker } from "./LiveTicker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  onToggleAlerts: () => void;
  onToggleAnalytics: () => void;
  alertsOpen: boolean;
  analyticsOpen: boolean;
  unreadAlerts: number;
}

export const Header = ({
  onToggleAlerts,
  onToggleAnalytics,
  alertsOpen,
  analyticsOpen,
  unreadAlerts,
}: HeaderProps) => {
  const { user, signOut } = useAuth();
  const [systemStatus, setSystemStatus] = useState<"operational" | "degraded" | "offline">("operational");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { error } = await supabase.from("ai_divisions").select("id").limit(1);
        setSystemStatus(error ? "degraded" : "operational");
      } catch {
        setSystemStatus("offline");
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <TooltipProvider>
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-b border-primary/20">
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary rounded-lg blur-lg opacity-40 animate-pulse" />
              <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center border border-primary/50">
                <span className="text-xl font-orbitron font-bold text-primary-foreground">A</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-orbitron font-bold tracking-wider bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                AICIS
              </h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5 tracking-wide">
                AI Civilization Intelligence System
              </p>
            </div>

            {/* Status indicator */}
            <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50">
              <div className={cn(
                "w-2 h-2 rounded-full",
                systemStatus === "operational" && "bg-success animate-pulse",
                systemStatus === "degraded" && "bg-warning animate-pulse",
                systemStatus === "offline" && "bg-destructive"
              )} />
              <span className="text-xs text-muted-foreground capitalize">{systemStatus}</span>
            </div>
          </div>

          {/* Time display */}
          <div className="hidden lg:flex flex-col items-center">
            <span className="text-2xl font-orbitron font-bold tracking-widest text-primary tabular-nums">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-muted-foreground -mt-0.5">
              {formatDate(currentTime)} UTC
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={analyticsOpen ? "default" : "ghost"}
                  size="sm"
                  className="h-9 gap-2"
                  onClick={onToggleAnalytics}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                  <Badge variant="outline" className="hidden md:flex text-[9px] px-1 py-0">D</Badge>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Press D to toggle</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={alertsOpen ? "default" : "ghost"}
                  size="sm"
                  className="h-9 gap-2 relative"
                  onClick={onToggleAlerts}
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Alerts</span>
                  <Badge variant="outline" className="hidden md:flex text-[9px] px-1 py-0">A</Badge>
                  {unreadAlerts > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive animate-pulse">
                      {unreadAlerts > 9 ? "9+" : unreadAlerts}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Press A to toggle</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-border mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Press ? for shortcuts</TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="hidden lg:block text-right">
                <div className="text-xs font-medium">{user?.email?.split("@")[0] || "Operator"}</div>
                <div className="flex items-center gap-1 justify-end">
                  <Activity className={cn(
                    "h-2 w-2",
                    systemStatus === "operational" ? "text-success" : "text-warning"
                  )} />
                  <span className="text-[10px] text-muted-foreground">Active</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Live ticker */}
        <div className="px-4 py-1.5 border-t border-border/30 bg-background/50">
          <LiveTicker />
        </div>
      </header>
    </TooltipProvider>
  );
};
