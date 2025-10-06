import { Card } from "@/components/ui/card";
import { Activity, Cpu, Database, Globe, TrendingUp } from "lucide-react";

export const SystemStatus = () => {
  const statusItems = [
    { 
      label: "System Uptime", 
      value: "99.99%", 
      icon: Activity,
      status: "optimal",
      detail: "142 days continuous"
    },
    { 
      label: "AI Cores Active", 
      value: "8/8", 
      icon: Cpu,
      status: "optimal",
      detail: "All divisions online"
    },
    { 
      label: "Global Operations", 
      value: "247", 
      icon: Globe,
      status: "active",
      detail: "Across 89 countries"
    },
    { 
      label: "Database Health", 
      value: "Optimal", 
      icon: Database,
      status: "optimal",
      detail: "12.4TB synchronized"
    },
    { 
      label: "Revenue Growth", 
      value: "+342%", 
      icon: TrendingUp,
      status: "excellent",
      detail: "Last 30 days"
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "text-success";
      case "active": return "text-primary";
      case "excellent": return "text-secondary";
      default: return "text-foreground";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {statusItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card 
            key={item.label}
            className="relative p-4 bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all duration-300 scan-line overflow-hidden group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 rounded-lg bg-muted/50 ${getStatusColor(item.status)}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className={`text-xs px-2 py-1 rounded-full bg-muted/50 ${getStatusColor(item.status)}`}>
                {item.status.toUpperCase()}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-2xl font-orbitron font-bold ${getStatusColor(item.status)}`}>
                {item.value}
              </p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
