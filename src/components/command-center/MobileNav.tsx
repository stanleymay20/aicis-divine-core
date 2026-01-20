import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Bell, BarChart3, Globe, Menu, Satellite, Radio,
  Brain, Activity, Cpu, Zap, X, MapPin,
  Vote, TrendingUp, Network, FileCheck, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  onToggleAlerts: () => void;
  onToggleAnalytics: () => void;
  onToggleData: () => void;
  onToggleSatellite: () => void;
  unreadAlerts: number;
  systemStatus: "operational" | "degraded" | "offline";
}

export const MobileNav = ({
  onToggleAlerts,
  onToggleAnalytics,
  onToggleData,
  onToggleSatellite,
  unreadAlerts,
  systemStatus,
}: MobileNavProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    {
      label: "Alerts",
      icon: Bell,
      badge: unreadAlerts,
      onClick: () => {
        onToggleAlerts();
        setIsOpen(false);
      },
      color: "text-destructive",
    },
    {
      label: "Analytics",
      icon: BarChart3,
      onClick: () => {
        onToggleAnalytics();
        setIsOpen(false);
      },
      color: "text-primary",
    },
    {
      label: "Live Data",
      icon: Radio,
      onClick: () => {
        onToggleData();
        setIsOpen(false);
      },
      color: "text-success",
    },
    {
      label: "Satellite",
      icon: Satellite,
      onClick: () => {
        onToggleSatellite();
        setIsOpen(false);
      },
      color: "text-secondary",
    },
  ];

  const navLinks = [
    { label: "Governance Hub", icon: Vote, path: "/governance", color: "text-primary" },
    { label: "Predictions", icon: TrendingUp, path: "/predictions", color: "text-success" },
    { label: "Federation", icon: Network, path: "/federation", color: "text-secondary" },
    { label: "Compliance", icon: FileCheck, path: "/compliance", color: "text-warning" },
    { label: "Admin Dashboard", icon: Shield, path: "/admin", color: "text-destructive" },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden relative"
        >
          <Menu className="h-5 w-5" />
          {unreadAlerts > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full text-[10px] flex items-center justify-center text-destructive-foreground font-bold">
              {unreadAlerts > 9 ? "9+" : unreadAlerts}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary rounded-lg blur-lg opacity-40" />
              <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <span className="text-xl font-orbitron font-bold text-primary-foreground">A</span>
              </div>
            </div>
            <div>
              <h1 className="font-orbitron font-bold">AICIS</h1>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  systemStatus === "operational" && "bg-success animate-pulse",
                  systemStatus === "degraded" && "bg-warning animate-pulse",
                  systemStatus === "offline" && "bg-destructive"
                )} />
                <span className="text-xs text-muted-foreground capitalize">{systemStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel toggles */}
        <div className="p-2 border-b border-border/50">
          <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Panels</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                onClick={item.onClick}
              >
                <div className={cn("p-2 rounded-lg bg-muted", item.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="flex-1 font-medium">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Navigation links */}
        <div className="p-2">
          <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Modules</p>
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                onClick={() => {
                  navigate(link.path);
                  setIsOpen(false);
                }}
              >
                <div className={cn("p-2 rounded-lg bg-muted", link.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="flex-1 font-medium">{link.label}</span>
              </button>
            );
          })}
        </div>

        {/* System status */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground">AI Cores</span>
              </div>
              <span className="font-orbitron font-bold text-sm">8/8</span>
            </div>
            <div className="p-2 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3.5 w-3.5 text-success" />
                <span className="text-[10px] text-muted-foreground">Status</span>
              </div>
              <span className="font-orbitron font-bold text-sm text-success">LIVE</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
