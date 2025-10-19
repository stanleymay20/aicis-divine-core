import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, Shield, Heart, Leaf, Zap, Globe, 
  Database, Brain, ArrowRight, Activity, CheckCircle, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "optimal":
    case "operational":
      return <CheckCircle className="w-4 h-4 text-success" />;
    case "active":
      return <Activity className="w-4 h-4 text-primary animate-pulse" />;
    case "ready":
      return <Brain className="w-4 h-4 text-cyan-400" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-warning" />;
  }
};

export const DivisionGrid = () => {
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDivisions = async () => {
      try {
        const { data: aiDivisions } = await supabase
          .from('ai_divisions')
          .select('*')
          .order('name');

        const { data: revenue } = await supabase
          .from('revenue_streams')
          .select('amount_usd, division')
          .gte('timestamp', new Date(Date.now() - 24 * 3600e3).toISOString());

        const { data: energy } = await supabase
          .from('energy_grid')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(50);

        const { data: health } = await supabase
          .from('health_data')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(50);

        const { data: food } = await supabase
          .from('food_security')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(50);

        const { data: crises } = await supabase
          .from('crisis_events')
          .select('*')
          .in('status', ['monitoring', 'escalated']);

        const iconMap: Record<string, any> = {
          'Financial Intelligence': DollarSign,
          'Finance Division': DollarSign,
          'Security Division': Shield,
          'Healthcare Division': Heart,
          'Food & Agriculture': Leaf,
          'Energy & Infrastructure': Zap,
          'Governance & Policy': Globe,
          'Cybersecurity Intelligence': Database,
          'J.A.R.V.I.S. Interface': Brain,
        };

        const divisionMetrics = (aiDivisions || []).map((div: any) => {
          const icon = iconMap[div.name] || Database;
          let metrics = [];

          if (div.name.includes('Finance') || div.name.includes('Financial')) {
            const total = (revenue || [])
              .filter((r: any) => r.division === 'finance')
              .reduce((a: number, b: any) => a + Number(b.amount_usd || 0), 0);
            metrics = [
              { label: 'Revenue (24h)', value: `$${Math.round(total).toLocaleString()}`, trend: '+42%' },
              { label: 'Performance', value: `${div.performance_score}%`, trend: 'Optimal' },
              { label: 'Uptime', value: `${div.uptime_percentage}%`, trend: '100%' },
            ];
          } else if (div.name.includes('Energy')) {
            const avgStability = (energy || []).reduce((a, b) => a + Number(b.stability_index || 0), 0) / Math.max(1, energy?.length || 1);
            const avgRenew = (energy || []).reduce((a, b) => a + Number(b.renewable_percentage || 0), 0) / Math.max(1, energy?.length || 1);
            metrics = [
              { label: 'Grid Efficiency', value: `${avgStability.toFixed(1)}%`, trend: '+2.3%' },
              { label: 'Renewable %', value: `${avgRenew.toFixed(0)}%`, trend: '+5%' },
              { label: 'Performance', value: `${div.performance_score}%`, trend: 'Online' },
            ];
          } else if (div.name.includes('Health')) {
            const totalAffected = (health || []).reduce((a, b) => a + Number(b.affected_count || 0), 0);
            metrics = [
              { label: 'Patients Monitored', value: `${(totalAffected / 1000).toFixed(1)}K`, trend: '+7%' },
              { label: 'Performance', value: `${div.performance_score}%`, trend: '+15%' },
              { label: 'Outbreak Alerts', value: '0', trend: 'Clear' },
            ];
          } else if (div.name.includes('Food') || div.name.includes('Agriculture')) {
            const avgYield = (food || []).reduce((a, b) => a + Number(b.yield_index || 0), 0) / Math.max(1, food?.length || 1);
            metrics = [
              { label: 'Yield Index', value: `${avgYield.toFixed(0)}%`, trend: '+8%' },
              { label: 'Regions', value: String((food || []).length), trend: 'Active' },
              { label: 'Performance', value: `${div.performance_score}%`, trend: '+12%' },
            ];
          } else {
            metrics = [
              { label: 'Performance', value: `${div.performance_score}%`, trend: 'Optimal' },
              { label: 'Uptime', value: `${div.uptime_percentage}%`, trend: '100%' },
              { label: 'Status', value: div.status, trend: 'Active' },
            ];
          }

          return {
            id: div.division_key,
            name: div.name,
            icon,
            status: div.status,
            color: 'text-primary',
            bgColor: 'bg-primary/10',
            metrics,
            description: `Real-time ${div.name.toLowerCase()} operations`,
          };
        });

        setDivisions(divisionMetrics);
      } catch (e) {
        console.error('Error loading divisions:', e);
      } finally {
        setLoading(false);
      }
    };

    loadDivisions();
    const interval = setInterval(loadDivisions, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading divisions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-orbitron font-bold text-primary">Division Status</h2>
          <p className="text-sm text-muted-foreground">{divisions.length} AI divisions operational and synchronized</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {divisions.map((division) => {
          const Icon = division.icon;
          return (
            <Card 
              key={division.id}
              className="relative p-6 bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all duration-300 group hover:scale-[1.02]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative space-y-4">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg ${division.bgColor}`}>
                    <Icon className={`w-6 h-6 ${division.color}`} />
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(division.status)}
                    <span className="text-xs text-muted-foreground uppercase">{division.status}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-orbitron font-semibold mb-1">{division.name}</h3>
                  <p className="text-xs text-muted-foreground">{division.description}</p>
                </div>

                <div className="space-y-2">
                  {division.metrics.map((metric) => (
                    <div key={metric.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{metric.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{metric.value}</span>
                        <span className={`text-xs ${
                          metric.trend.includes('+') ? 'text-success' : 
                          metric.trend === '0%' ? 'text-muted-foreground' : 
                          'text-primary'
                        }`}>
                          {metric.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full group/btn"
                >
                  View Details
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
