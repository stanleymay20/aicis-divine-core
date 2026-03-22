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
  Activity,
  Brain,
  Shield,
  Cpu,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface NavGroup {
  label: string;
  items: { id: string; label: string; icon: typeof LayoutDashboard; path: string }[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard, path: "/" },
      { id: "decision-ops", label: "Operations", icon: Activity, path: "/decision-ops" },
      { id: "intelligence", label: "Intelligence", icon: Brain, path: "/intelligence" },
    ],
  },
  {
    label: "Assurance",
    items: [
      { id: "governance", label: "Governance", icon: Shield, path: "/governance" },
      { id: "operational-truth", label: "Operational Truth", icon: Cpu, path: "/operational-truth" },
      { id: "decision-engine", label: "Models", icon: Cpu, path: "/decision-engine" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "billing", label: "Billing", icon: CreditCard, path: "/decision-ops" },
      { id: "admin", label: "Settings", icon: Settings, path: "/admin" },
    ],
  },
];

const allItems = navigationGroups.flatMap(g => g.items);

export const AICISSidebar = ({ collapsed, onToggle, activeSection, onSectionChange }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (item: typeof allItems[0]) => {
    onSectionChange(item.id);
    navigate(item.path);
  };

  const isActive = (item: typeof allItems[0]) => {
    if (item.path === "/" && location.pathname === "/") return true;
    if (item.path !== "/" && location.pathname.startsWith(item.path)) return true;
    return false;
  };

  return (
    <TooltipProvider>
      {/* Desktop sidebar */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-14 bottom-0 z-40 bg-card border-r border-border transition-all duration-200 hidden md:flex flex-col",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-6 h-6 w-6 rounded-full bg-card border border-border z-50 hover:bg-accent"
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-6 px-3">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest px-2 mb-2">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
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
                                "w-full h-9 justify-center rounded-md",
                                active && "bg-primary/10 text-primary"
                              )}
                              onClick={() => handleNavClick(item)}
                            >
                              <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                        </Tooltip>
                      );
                    }

                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        className={cn(
                          "w-full h-9 justify-start gap-3 px-2 text-[13px] font-medium rounded-md",
                          active && "bg-primary/10 text-primary",
                          !active && "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                        onClick={() => handleNavClick(item)}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        <span className="truncate">{item.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {!collapsed && (
          <div className="p-3 border-t border-border">
            <div className="text-[10px] text-muted-foreground text-center font-mono">
              AICIS v2.0
            </div>
          </div>
        )}
      </aside>

      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        className="fixed left-3 top-[58px] z-50 md:hidden h-9 w-9 bg-card border border-border"
        onClick={onToggle}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Mobile overlay */}
      {!collapsed && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={onToggle}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-14 bottom-0 w-[220px] bg-card border-r border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground">Navigation</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-full py-4">
              <nav className="space-y-6 px-3">
                {navigationGroups.map((group) => (
                  <div key={group.label}>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest px-2 mb-2">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item);
                        return (
                          <Button
                            key={item.id}
                            variant="ghost"
                            className={cn(
                              "w-full h-9 justify-start gap-3 px-2 text-[13px] font-medium rounded-md",
                              active && "bg-primary/10 text-primary",
                              !active && "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                            onClick={() => { handleNavClick(item); onToggle(); }}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                            <span className="truncate">{item.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </ScrollArea>
          </aside>
        </div>
      )}
    </TooltipProvider>
  );
};
