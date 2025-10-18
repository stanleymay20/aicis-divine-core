import { Button } from "@/components/ui/button";
import { Activity, Shield, DollarSign, Heart, Leaf, Zap, Globe, MessageSquare, LogOut, Settings, Home, Apple, Building, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DashboardHeaderProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export const DashboardHeader = ({ activeView, setActiveView }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  
  const navItems = [
    { id: "overview", label: "Dashboard", icon: Home },
    { id: "economy", label: "Economy", icon: DollarSign },
    { id: "health", label: "Health", icon: Heart },
    { id: "food", label: "Food", icon: Apple },
    { id: "energy", label: "Energy", icon: Zap },
    { id: "governance", label: "Governance", icon: Building },
    { id: "dao", label: "DAO", icon: Users },
    { id: "automation", label: "Automation", icon: Settings },
  ];

  return (
    <header className="border-b border-primary/20 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-50 animate-pulse-glow" />
              <div className="relative w-12 h-12 rounded-full bg-gradient-cyber flex items-center justify-center">
                <span className="text-2xl font-orbitron font-bold text-primary-foreground">A</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-orbitron font-bold text-glow-cyber">AICIS</h1>
              <p className="text-sm text-muted-foreground">Autonomous Intelligence Command System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-success">All Systems Operational</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {user?.email}
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={signOut}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-2 whitespace-nowrap ${
                  isActive ? "glow-cyber" : ""
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
