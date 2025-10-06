import { Card } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const revenueData = [
  { time: "00:00", value: 125000 },
  { time: "04:00", value: 178000 },
  { time: "08:00", value: 245000 },
  { time: "12:00", value: 312000 },
  { time: "16:00", value: 289000 },
  { time: "20:00", value: 367000 },
];

const operationsData = [
  { time: "00:00", trades: 1240, threats: 3, energy: 89 },
  { time: "04:00", trades: 1567, threats: 1, energy: 92 },
  { time: "08:00", trades: 2103, threats: 2, energy: 88 },
  { time: "12:00", trades: 2456, threats: 0, energy: 95 },
  { time: "16:00", trades: 2234, threats: 1, energy: 91 },
  { time: "20:00", trades: 2678, threats: 0, energy: 94 },
];

export const MetricsPanel = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="mb-4">
          <h3 className="text-lg font-orbitron font-semibold text-primary">Revenue Generation</h3>
          <p className="text-sm text-muted-foreground">Real-time trading performance (24h)</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--primary))",
                borderRadius: "8px"
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--secondary))" 
              fill="url(#revenueGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="mb-4">
          <h3 className="text-lg font-orbitron font-semibold text-primary">Global Operations</h3>
          <p className="text-sm text-muted-foreground">Multi-division activity metrics (24h)</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={operationsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--primary))",
                borderRadius: "8px"
              }}
            />
            <Line 
              type="monotone" 
              dataKey="trades" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Trades"
            />
            <Line 
              type="monotone" 
              dataKey="energy" 
              stroke="hsl(var(--success))" 
              strokeWidth={2}
              name="Energy Efficiency %"
            />
            <Line 
              type="monotone" 
              dataKey="threats" 
              stroke="hsl(var(--destructive))" 
              strokeWidth={2}
              name="Threats Detected"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};
