import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Activity, User, LogOut, ShieldOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import aicisLogo from "@/assets/aicis-logo.png";
import { ThreeLayerStack } from "./ThreeLayerStack";
import { AtlasStatusBadge } from "./AtlasStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const AICISTopBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isHome = location.pathname === "/";
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dataFeedStatus, setDataFeedStatus] = useState<"online" | "partial" | "offline">("online");
  const [criticalAlerts, setCriticalAlerts] = useState(0);
  const [lastCriticalTime, setLastCriticalTime] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Check data feed status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Use automation_logs for accurate feed status (data_source_log only has 'success' rows)
        const { data, error } = await supabase
          .from("automation_logs")
          .select("status")
          .order("executed_at", { ascending: false })
          .limit(20);

        if (error) {
          setDataFeedStatus("partial");
          return;
        }

        const failedCount = data?.filter(d => d.status === "error").length || 0;
        if (failedCount <= 2) setDataFeedStatus("online");
        else if (failedCount < 10) setDataFeedStatus("partial");
        else setDataFeedStatus("offline");
      } catch {
        setDataFeedStatus("partial");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch critical alerts
  useEffect(() => {
    const fetchCritical = async () => {
      const { count, data } = await supabase
        .from("critical_alerts")
        .select("*", { count: "exact" })
        .eq("acknowledged", false)
        .order("triggered_at", { ascending: false })
        .limit(1);

      setCriticalAlerts(count || 0);
      if (data && data.length > 0) {
        const time = new Date(data[0].triggered_at);
        const diff = Math.floor((Date.now() - time.getTime()) / 60000);
        setLastCriticalTime(diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`);
      }
    };

    fetchCritical();
    const channel = supabase
      .channel("critical-alerts-topbar")
      .on("postgres_changes", { event: "*", schema: "public", table: "critical_alerts" }, fetchCritical)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC"
    });
  };

  return (
    <TooltipProvider>
      <header role="banner" aria-label="AICIS global status bar" className="h-12 bg-card/95 backdrop-blur-xl border-b border-primary/20 flex items-center justify-between px-4 z-50 shrink-0">
        {/* Left: Back Button + Logo & Title */}
        <div className="flex items-center gap-3">
          {/* Universal Back Button */}
          {!isHome && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(-1)}
                  aria-label="Go back to previous page"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Go Back</TooltipContent>
            </Tooltip>
          )}

          {/* Logo - always navigates to dashboard */}
          <div 
            className="relative cursor-pointer group"
            onClick={() => navigate("/")}
          >
            <div className="absolute inset-0 bg-primary rounded-full blur-md opacity-40 group-hover:opacity-60 transition-opacity" />
            <img 
              src={aicisLogo} 
              alt="AICIS" 
              className="relative w-8 h-8 object-contain drop-shadow-[0_0_8px_hsl(var(--primary))]"
            />
          </div>
          
          <div className="hidden sm:flex flex-col">
            <span 
              className="text-sm font-orbitron font-bold tracking-wider text-primary cursor-pointer hover:text-primary-glow transition-colors"
              onClick={() => navigate("/")}
            >
              AICIS
            </span>
            <span className="text-[9px] text-muted-foreground -mt-0.5 tracking-wide hidden md:block">
              Global Intelligence Active
            </span>
          </div>
        </div>

        {/* Center: Atlas + Three-Layer Stack + Status Indicators */}
        <div className="flex items-center gap-4">
          {/* Atlas Research Engine Badge */}
          <AtlasStatusBadge className="hidden md:flex" />

          {/* Three-Layer Stack (compact) */}
          <ThreeLayerStack compact className="hidden lg:flex" />

          {/* Non-Surveillance Badge */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/30 cursor-pointer hover:bg-success/20 transition-colors"
                onClick={() => navigate("/ethics")}
              >
                <ShieldOff className="h-3 w-3 text-success" />
                <span className="text-[10px] font-medium text-success hidden sm:inline">
                  Non-Surveillance
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p className="font-medium">Non-Surveillance Guarantee</p>
              <p className="text-muted-foreground">No individuals tracked — aggregate intelligence only</p>
            </TooltipContent>
          </Tooltip>

          {/* Data Feeds */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/30 border border-border/50">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  dataFeedStatus === "online" && "bg-success animate-pulse",
                  dataFeedStatus === "partial" && "bg-warning animate-pulse",
                  dataFeedStatus === "offline" && "bg-destructive"
                )} />
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {dataFeedStatus === "online" ? "Data Feeds Online" : 
                   dataFeedStatus === "partial" ? "Partial Coverage" : "Feeds Offline"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Real-time data feed status</TooltipContent>
          </Tooltip>

          {/* Critical Alerts */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-full border",
                criticalAlerts > 0 
                  ? "bg-destructive/20 border-destructive/50 animate-pulse" 
                  : "bg-muted/30 border-border/50"
              )}>
                <Bell className={cn(
                  "h-3.5 w-3.5",
                  criticalAlerts > 0 ? "text-destructive" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-xs",
                  criticalAlerts > 0 ? "text-destructive font-medium" : "text-muted-foreground"
                )}>
                  {criticalAlerts > 0 ? `${criticalAlerts} Critical Alerts Active` : "No Critical Alerts"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {lastCriticalTime ? `Latest: ${lastCriticalTime}` : "No active critical alerts"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right: Time & User */}
        <div className="flex items-center gap-4">
          {/* UTC Time */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-lg font-orbitron font-bold tracking-widest text-primary tabular-nums">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-muted-foreground">UTC</span>
          </div>

          {/* Alert Bell with Count */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            aria-label={`Alerts${criticalAlerts > 0 ? `, ${criticalAlerts} critical` : ''}`}
            onClick={() => navigate("/")}
          >
            <Bell className="h-4 w-4" />
            {criticalAlerts > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-destructive">
                {criticalAlerts > 9 ? "9+" : criticalAlerts}
              </Badge>
            )}
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="User menu">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.email?.split("@")[0] || "Operator"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Activity className="h-2 w-2 text-success" /> Active
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
};
