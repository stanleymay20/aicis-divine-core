import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageSquare,
  Activity,
  Shield,
  Cpu,
  Settings,
  CreditCard,
  Target,
  X,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems = [
  { id: "overview", label: "Decisions", icon: MessageSquare, path: "/" },
  { id: "decision-ops", label: "Operations", icon: Activity, path: "/decision-ops" },
  { id: "operational-truth", label: "Truth", icon: Cpu, path: "/operational-truth" },
  { id: "governance", label: "Governance", icon: Shield, path: "/governance" },
  { id: "billing", label: "Billing", icon: CreditCard, path: "/enterprise-governance" },
  { id: "admin", label: "Settings", icon: Settings, path: "/admin" },
];

export const AICISSidebar = ({ collapsed, onToggle, activeSection, onSectionChange }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (item: typeof navItems[0]) => {
    onSectionChange(item.id);
    navigate(item.path);
  };

  const isActive = (item: typeof navItems[0]) => {
    if (item.path === "/" && location.pathname === "/") return true;
    if (item.path !== "/" && location.pathname.startsWith(item.path)) return true;
    return false;
  };

  return (
    <TooltipProvider>
      {/* Desktop — always icon-only rail */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className="fixed left-0 top-12 bottom-0 z-40 w-[52px] bg-card border-r border-border hidden md:flex flex-col items-center py-4"
      >
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "w-9 h-9 rounded-lg",
                      active && "bg-primary/10 text-primary",
                      !active && "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => handleNavClick(item)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {!collapsed && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={onToggle}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-[220px] bg-card border-r border-border p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold">AICIS</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className={cn(
                      "w-full h-10 justify-start gap-3 text-sm rounded-lg",
                      active && "bg-primary/10 text-primary",
                      !active && "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => { handleNavClick(item); onToggle(); }}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </TooltipProvider>
  );
};
