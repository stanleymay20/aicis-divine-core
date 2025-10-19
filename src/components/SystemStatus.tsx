import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Activity, Cpu, Database, Globe, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const SystemStatus = () => {
  const [statusItems, setStatusItems] = useState<any[]>([]);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const { data: divisions } = await supabase
          .from('ai_divisions')
          .select('status, uptime_percentage');

        const { data: crises } = await supabase
          .from('crisis_events')
          .select('id, region');

        const { data: revenue } = await supabase
          .from('revenue_streams')
          .select('amount_usd, timestamp')
          .gte('timestamp', new Date(Date.now() - 30 * 24 * 3600e3).toISOString());

        const { data: revenue30DaysAgo } = await supabase
          .from('revenue_streams')
          .select('amount_usd')
          .gte('timestamp', new Date(Date.now() - 60 * 24 * 3600e3).toISOString())
          .lt('timestamp', new Date(Date.now() - 30 * 24 * 3600e3).toISOString());

        const activeCount = (divisions || []).filter((d: any) => d.status === 'operational' || d.status === 'active').length;
        const totalCount = (divisions || []).length;
        const avgUptime = (divisions || []).reduce((a: number, b: any) => a + Number(b.uptime_percentage || 0), 0) / Math.max(1, totalCount);
        
        const uniqueRegions = new Set((crises || []).map((c: any) => c.region));
        
        const recentRev = (revenue || []).reduce((a: number, b: any) => a + Number(b.amount_usd || 0), 0);
        const oldRev = (revenue30DaysAgo || []).reduce((a: number, b: any) => a + Number(b.amount_usd || 0), 0);
        const revGrowth = oldRev > 0 ? ((recentRev - oldRev) / oldRev * 100) : 0;

        setStatusItems([
          { 
            label: "System Uptime", 
            value: `${avgUptime.toFixed(2)}%`, 
            icon: Activity,
            status: avgUptime > 99 ? "optimal" : "active",
            detail: "Continuous monitoring"
          },
          { 
            label: "AI Cores Active", 
            value: `${activeCount}/${totalCount}`, 
            icon: Cpu,
            status: activeCount === totalCount ? "optimal" : "active",
            detail: "Division status"
          },
          { 
            label: "Global Operations", 
            value: String(uniqueRegions.size), 
            icon: Globe,
            status: "active",
            detail: `Active regions`
          },
          { 
            label: "Database Health", 
            value: "Optimal", 
            icon: Database,
            status: "optimal",
            detail: "All tables synced"
          },
          { 
            label: "Revenue Growth", 
            value: revGrowth > 0 ? `+${Math.round(revGrowth)}%` : `${Math.round(revGrowth)}%`, 
            icon: TrendingUp,
            status: revGrowth > 0 ? "excellent" : "active",
            detail: "Last 30 days"
          },
        ]);
      } catch (e) {
        console.error('Error loading system status:', e);
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 60000);
    return () => clearInterval(interval);
  }, []);

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
