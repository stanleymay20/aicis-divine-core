import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Globe,
  Landmark,
  Swords,
  HeartPulse,
  TrendingUp,
  Zap,
  FileCheck,
  Shield,
  Scale,
  Activity,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

import { GitCompareArrows, Layers, Brain, Target, FileText, Eye } from "lucide-react";

const navigationItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
  { id: "command", label: "Command Center", icon: Globe, path: "/command" },
  { id: "intelligence", label: "Intelligence Thread", icon: Layers, path: "/intelligence" },
  { id: "adi", label: "Decision Intelligence", icon: Brain, path: "/adi" },
  { id: "compare", label: "Compare Countries", icon: GitCompareArrows, path: "/compare" },
  { id: "governance", label: "Governance", icon: Landmark, path: "/governance" },
  { id: "security", label: "Security & Conflict", icon: Swords, path: "/security" },
  { id: "health", label: "Health", icon: HeartPulse, path: "/health" },
  { id: "predictions", label: "Predictions", icon: TrendingUp, path: "/predictions" },
  { id: "prediction-accuracy", label: "Prediction Accuracy", icon: Target, path: "/prediction-accuracy" },
  { id: "weekly-briefs", label: "Weekly Briefs", icon: FileText, path: "/weekly-briefs" },
  { id: "trust", label: "Trust & Transparency", icon: Eye, path: "/trust" },
  { id: "federation", label: "Federation", icon: Zap, path: "/federation" },
  { id: "compliance", label: "Compliance", icon: FileCheck, path: "/compliance" },
  { id: "admin", label: "Admin", icon: Shield, path: "/admin" },
  { id: "ethics", label: "AI Ethics & SDGs", icon: Scale, path: "/ethics" },
  { id: "system", label: "System Health", icon: Activity, path: "/system-health" },
];

export const AICISSidebar = ({ collapsed, onToggle, activeSection, onSectionChange }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (item: typeof navigationItems[0]) => {
    onSectionChange(item.id);
    if (item.path !== "/") {
      navigate(item.path);
    } else {
      // For sections on the main page, navigate to main and scroll or activate
      navigate("/");
    }
  };

  const isActive = (item: typeof navigationItems[0]) => {
    if (item.path !== "/" && location.pathname.startsWith(item.path)) return true;
    if (item.path === "/" && location.pathname === "/" && activeSection === item.id) return true;
    return false;
  };

  return (
    <TooltipProvider>
      <aside 
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-12 bottom-8 z-40 bg-card/95 backdrop-blur-xl border-r border-primary/20 transition-all duration-300 hidden md:flex flex-col",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-4 h-6 w-6 rounded-full bg-card border border-border z-50"
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        {/* Navigation Items */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              if (collapsed) {
                return (
                  <Tooltip key={item.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "w-full h-10 justify-center",
                          active && "bg-primary/20 text-primary border-l-2 border-primary"
                        )}
                        onClick={() => handleNavClick(item)}
                      >
                        <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full h-10 justify-start gap-3 px-3 text-sm",
                    active && "bg-primary/20 text-primary border-l-2 border-primary",
                    !active && "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => handleNavClick(item)}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{item.label}</span>
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Bottom section */}
        {!collapsed && (
          <div className="p-3 border-t border-border/50">
            <div className="text-[10px] text-muted-foreground text-center">
              AICIS v2.0 • Global Intelligence
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={collapsed ? "Open navigation menu" : "Close navigation menu"}
        className="fixed left-2 top-14 z-50 md:hidden h-10 w-10 bg-card/90 border border-border"
        onClick={onToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Sidebar Overlay */}
      {!collapsed && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={onToggle}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <aside 
            className="absolute left-0 top-12 bottom-0 w-56 bg-card border-r border-primary/20"
            onClick={e => e.stopPropagation()}
          >
            <ScrollArea className="h-full py-4">
              <nav className="space-y-1 px-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);

                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={cn(
                        "w-full h-10 justify-start gap-3 px-3 text-sm",
                        active && "bg-primary/20 text-primary",
                        !active && "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => {
                        handleNavClick(item);
                        onToggle();
                      }}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate">{item.label}</span>
                    </Button>
                  );
                })}
              </nav>
            </ScrollArea>
          </aside>
        </div>
      )}
    </TooltipProvider>
  );
};
