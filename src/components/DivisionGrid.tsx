import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, Shield, Heart, Leaf, Zap, Globe, 
  Database, Brain, ArrowRight, TrendingUp, AlertTriangle,
  Activity, CheckCircle
} from "lucide-react";

const divisions = [
  {
    id: "finance",
    name: "Financial Intelligence",
    icon: DollarSign,
    status: "operational",
    color: "text-secondary",
    bgColor: "bg-secondary/10",
    metrics: [
      { label: "Active Trades", value: "2,456", trend: "+18%" },
      { label: "Revenue (24h)", value: "$367K", trend: "+42%" },
      { label: "Exchanges", value: "7 Connected", trend: "100%" },
    ],
    description: "High-frequency trading across global markets",
  },
  {
    id: "security",
    name: "Military & Security",
    icon: Shield,
    status: "active",
    color: "text-primary",
    bgColor: "bg-primary/10",
    metrics: [
      { label: "Threats Detected", value: "0", trend: "0%" },
      { label: "Systems Protected", value: "247", trend: "100%" },
      { label: "Response Time", value: "<0.001s", trend: "Optimal" },
    ],
    description: "Real-time threat detection and autonomous defense",
  },
  {
    id: "healthcare",
    name: "Healthcare Division",
    icon: Heart,
    status: "operational",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    metrics: [
      { label: "Patients Monitored", value: "12.4M", trend: "+7%" },
      { label: "AI Diagnostics", value: "3,456", trend: "+15%" },
      { label: "Outbreak Alerts", value: "0", trend: "Clear" },
    ],
    description: "Predictive healthcare and pandemic response",
  },
  {
    id: "agriculture",
    name: "Food & Agriculture",
    icon: Leaf,
    status: "operational",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    metrics: [
      { label: "Farms Managed", value: "8,932", trend: "+12%" },
      { label: "Yield Optimization", value: "94%", trend: "+8%" },
      { label: "Supply Chains", value: "156", trend: "Active" },
    ],
    description: "Smart agriculture and global food security",
  },
  {
    id: "energy",
    name: "Energy & Infrastructure",
    icon: Zap,
    status: "optimal",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    metrics: [
      { label: "Grid Efficiency", value: "96.8%", trend: "+2.3%" },
      { label: "Power Stations", value: "423", trend: "Online" },
      { label: "Renewable %", value: "68%", trend: "+5%" },
    ],
    description: "Global energy grid management and optimization",
  },
  {
    id: "governance",
    name: "Governance & Policy",
    icon: Globe,
    status: "operational",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    metrics: [
      { label: "Nations Assisted", value: "89", trend: "+3" },
      { label: "Policies Analyzed", value: "1,234", trend: "+45%" },
      { label: "Crisis Predictions", value: "12", trend: "Prevented" },
    ],
    description: "AI-driven policy and civilization management",
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity Intelligence",
    icon: Database,
    status: "active",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    metrics: [
      { label: "Networks Secured", value: "1,847", trend: "100%" },
      { label: "Attacks Blocked", value: "23,456", trend: "+67%" },
      { label: "Data Protected", value: "12.4TB", trend: "Encrypted" },
    ],
    description: "Real-time cyber defense and digital warfare",
  },
  {
    id: "assistant",
    name: "J.A.R.V.I.S. Interface",
    icon: Brain,
    status: "ready",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    metrics: [
      { label: "Commands Processed", value: "45,678", trend: "+89%" },
      { label: "Response Time", value: "0.02s", trend: "Fast" },
      { label: "Accuracy", value: "99.9%", trend: "Excellent" },
    ],
    description: "Natural language command and control interface",
  },
];

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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-orbitron font-bold text-primary">Division Status</h2>
          <p className="text-sm text-muted-foreground">All 8 AI divisions operational and synchronized</p>
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
