/**
 * Trend Decomposition Chart
 * Shows baseline vs shock vs seasonal components of a metric
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Layers, Info } from "lucide-react";

interface DecompositionPoint {
  date: string;
  total: number;
  baseline: number;
  seasonal?: number;
  shock?: number;
}

interface TrendDecompositionProps {
  data: DecompositionPoint[];
  title?: string;
  unit?: string;
  height?: number;
}

export const TrendDecomposition = ({
  data,
  title = "Trend Decomposition",
  unit = "",
  height = 280,
}: TrendDecompositionProps) => {
  const hasShock = data.some(d => d.shock && Math.abs(d.shock) > 0.01);
  const hasSeasonal = data.some(d => d.seasonal && Math.abs(d.seasonal) > 0.01);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value?.toFixed(2)} {unit}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="text-xs gap-1">
            <Info className="h-3 w-3" />
            {hasShock ? "Shock detected" : "Stable trend"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Decomposition: baseline trend + seasonal pattern + external shocks
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'currentColor', fontSize: 10 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'currentColor', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="line"
            />
            
            <Area
              type="monotone"
              dataKey="baseline"
              name="Baseline Trend"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            
            {hasSeasonal && (
              <Area
                type="monotone"
                dataKey="seasonal"
                name="Seasonal"
                stroke="hsl(var(--secondary))"
                fill="hsl(var(--secondary))"
                fillOpacity={0.1}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}

            {hasShock && (
              <Area
                type="monotone"
                dataKey="shock"
                name="External Shock"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.1}
                strokeWidth={1.5}
              />
            )}

            <Area
              type="monotone"
              dataKey="total"
              name="Observed Total"
              stroke="hsl(var(--foreground))"
              fill="none"
              strokeWidth={2}
              strokeDasharray="2 2"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
