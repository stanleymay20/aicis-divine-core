import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, User, LogOut, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const AICISTopBar = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dataFeedStatus, setDataFeedStatus] = useState<"online" | "partial" | "offline">("online");
  const [criticalAlerts, setCriticalAlerts] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data } = await supabase
          .from("automation_logs")
          .select("status")
          .order("executed_at", { ascending: false })
          .limit(20);
        if (data) {
          const failedCount = data.filter(d => d.status === "error").length;
          if (failedCount <= 2) setDataFeedStatus("online");
          else if (failedCount < 10) setDataFeedStatus("partial");
          else setDataFeedStatus("offline");
        }
      } catch { setDataFeedStatus("partial"); }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchCritical = async () => {
      const { count } = await supabase
        .from("critical_alerts")
        .select("*", { count: "exact", head: true })
        .eq("acknowledged", false);
      setCriticalAlerts(count || 0);
    };
    fetchCritical();
    const channel = supabase
      .channel("critical-alerts-topbar")
      .on("postgres_changes", { event: "*", schema: "public", table: "critical_alerts" }, fetchCritical)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" });

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 z-50 shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-sm">AI</span>
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-semibold tracking-tight">AICIS</div>
          <div className="text-[10px] text-muted-foreground -mt-0.5">Decision Intelligence</div>
        </div>
      </div>

      {/* Center: Status indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            dataFeedStatus === "online" && "bg-success status-pulse",
            dataFeedStatus === "partial" && "bg-warning status-pulse",
            dataFeedStatus === "offline" && "bg-destructive"
          )} />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {dataFeedStatus === "online" ? "Online" : dataFeedStatus === "partial" ? "Partial" : "Offline"}
          </span>
        </div>

        {criticalAlerts > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
            {criticalAlerts} Alert{criticalAlerts !== 1 ? 's' : ''}
          </Badge>
        )}

        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span className="text-[10px]">UTC</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => navigate("/")}>
          <Bell className="h-4 w-4 text-muted-foreground" />
          {criticalAlerts > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <User className="h-4 w-4 text-muted-foreground" />
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
  );
};
