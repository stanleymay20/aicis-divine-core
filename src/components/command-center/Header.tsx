import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, BarChart3, LogOut, Settings, User,
  Activity, Wifi, WifiOff, Menu
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  const [isOnline, setIsOnline] = useState(true);
  const [systemStatus, setSystemStatus] = useState<"operational" | "degraded" | "offline">("operational");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Check system status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { error } = await supabase.from("ai_divisions").select("id").limit(1);
        setSystemStatus(error ? "degraded" : "operational");
        setIsOnline(true);
      } catch {
        setSystemStatus("offline");
        setIsOnline(false);
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-b border-primary/20">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Logo & Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary rounded-lg blur-lg opacity-40 animate-pulse" />
              <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <span className="text-xl font-orbitron font-bold text-primary-foreground">A</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-orbitron font-bold tracking-wider">AICIS</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">
                AI Civilization Intelligence System
              </p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50">
            <Activity className={cn(
              "h-3 w-3",
              systemStatus === "operational" ? "text-success" :
              systemStatus === "degraded" ? "text-warning" : "text-destructive"
            )} />
            <span className="text-xs text-muted-foreground capitalize">{systemStatus}</span>
            <div className="w-px h-3 bg-border" />
            {isOnline ? (
              <Wifi className="h-3 w-3 text-success" />
            ) : (
              <WifiOff className="h-3 w-3 text-destructive" />
            )}
          </div>
        </div>

        {/* Center - Time */}
        <div className="hidden lg:flex flex-col items-center">
          <span className="text-xl font-orbitron font-bold tracking-widest text-primary">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDate(currentTime)} UTC
          </span>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Analytics toggle */}
          <Button
            variant={analyticsOpen ? "default" : "ghost"}
            size="sm"
            className="h-9 gap-2"
            onClick={onToggleAnalytics}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </Button>

          {/* Alerts toggle */}
          <Button
            variant={alertsOpen ? "default" : "ghost"}
            size="sm"
            className="h-9 gap-2 relative"
            onClick={onToggleAlerts}
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
            {unreadAlerts > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive"
              >
                {unreadAlerts > 9 ? "9+" : unreadAlerts}
              </Badge>
            )}
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* User menu */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block text-right">
              <div className="text-xs font-medium truncate max-w-[120px]">
                {user?.email?.split("@")[0] || "User"}
              </div>
              <div className="text-[10px] text-muted-foreground">Operator</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
