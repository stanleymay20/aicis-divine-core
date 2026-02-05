 import { useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { 
   AreaChart, Area, XAxis, YAxis, CartesianGrid, 
   Tooltip, ResponsiveContainer, ReferenceLine, Line, ComposedChart
 } from "recharts";
 import { Info } from "lucide-react";
 
 interface ForecastDataPoint {
   date: string;
   value: number;
   upper?: number; // Upper confidence bound
   lower?: number; // Lower confidence bound
   isForecast?: boolean;
 }
 
 interface ForecastFanChartProps {
   data: ForecastDataPoint[];
   title?: string;
   subtitle?: string;
   confidence?: number; // Overall confidence (max 0.95)
   color?: string;
   unit?: string;
   annotations?: Array<{ date: string; label: string; type: "trigger" | "event" | "milestone" }>;
   showLegend?: boolean;
   height?: number;
 }
 
 export const ForecastFanChart = ({
   data,
   title,
   subtitle,
   confidence = 0.8,
   color = "hsl(var(--primary))",
   unit,
   annotations = [],
   showLegend = true,
   height = 300
 }: ForecastFanChartProps) => {
   // Compute fan chart bands if not provided
   const chartData = useMemo(() => {
     return data.map((point, idx) => {
       const isForecast = point.isForecast ?? idx > data.length * 0.6;
       
       // Expand uncertainty for future dates
       const uncertaintyFactor = isForecast ? 1 + (idx / data.length) * 0.3 : 0.1;
       const baseSpread = point.value * uncertaintyFactor * (1 - confidence);
       
       return {
         ...point,
         isForecast,
         upper: point.upper ?? point.value + baseSpread,
         lower: point.lower ?? Math.max(0, point.value - baseSpread),
         band: point.upper !== undefined ? [point.lower, point.upper] : [point.value - baseSpread, point.value + baseSpread]
       };
     });
   }, [data, confidence]);
 
   const historyEndIndex = chartData.findIndex(d => d.isForecast);
 
   const CustomTooltip = ({ active, payload, label }: any) => {
     if (!active || !payload || !payload.length) return null;
     const point = payload[0]?.payload;
     return (
       <div className="bg-card border rounded-lg shadow-lg p-3">
         <p className="font-medium">{label}</p>
         <p className="text-sm">
           Value: <span className="font-bold">{point?.value?.toFixed(2)}</span> {unit}
         </p>
         {point?.isForecast && (
           <>
             <p className="text-xs text-muted-foreground mt-1">
               Range: {point?.lower?.toFixed(2)} - {point?.upper?.toFixed(2)}
             </p>
             <Badge variant="outline" className="mt-2 text-xs">
               Forecast (≤{Math.round(confidence * 100)}% confidence)
             </Badge>
           </>
         )}
       </div>
     );
   };
 
   return (
     <Card>
       {(title || subtitle) && (
         <CardHeader className="pb-2">
           <div className="flex items-center justify-between">
             <div>
               {title && <CardTitle className="text-base">{title}</CardTitle>}
               {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
             </div>
             <Badge variant="outline" className="gap-1">
               <Info className="h-3 w-3" />
               Max {Math.min(Math.round(confidence * 100), 95)}% confidence
             </Badge>
           </div>
         </CardHeader>
       )}
       <CardContent>
         <ResponsiveContainer width="100%" height={height}>
           <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
             <defs>
               <linearGradient id="fanGradient" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                 <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
               </linearGradient>
               <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="5%" stopColor={color} stopOpacity={0.5}/>
                 <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
               </linearGradient>
             </defs>
             <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
             <XAxis 
               dataKey="date" 
               tick={{ fill: 'currentColor', fontSize: 11 }}
               tickLine={false}
             />
             <YAxis 
               tick={{ fill: 'currentColor', fontSize: 11 }}
               tickLine={false}
               axisLine={false}
               tickFormatter={(val) => val.toLocaleString()}
             />
             <Tooltip content={<CustomTooltip />} />
             
             {/* Uncertainty band (fan) */}
             <Area
               type="monotone"
               dataKey="upper"
               stroke="none"
               fill="url(#fanGradient)"
               fillOpacity={0.4}
             />
             <Area
               type="monotone"
               dataKey="lower"
               stroke="none"
               fill="white"
               fillOpacity={1}
             />
             
             {/* Main trend line */}
             <Line
               type="monotone"
               dataKey="value"
               stroke={color}
               strokeWidth={2}
               dot={false}
             />
 
             {/* Vertical line separating history from forecast */}
             {historyEndIndex > 0 && (
               <ReferenceLine
                 x={chartData[historyEndIndex]?.date}
                 stroke="hsl(var(--muted-foreground))"
                 strokeDasharray="3 3"
                 label={{ 
                   value: "Forecast →", 
                   position: "top",
                   fill: "hsl(var(--muted-foreground))",
                   fontSize: 10
                 }}
               />
             )}
 
             {/* Annotations */}
             {annotations.map((ann, idx) => (
               <ReferenceLine
                 key={idx}
                 x={ann.date}
                 stroke={ann.type === "trigger" ? "#ef4444" : ann.type === "event" ? "#f59e0b" : "#10b981"}
                 strokeDasharray="5 5"
                 label={{ 
                   value: ann.label, 
                   position: "insideTopRight",
                   fill: "currentColor",
                   fontSize: 9
                 }}
               />
             ))}
           </ComposedChart>
         </ResponsiveContainer>
 
         {showLegend && (
           <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
             <div className="flex items-center gap-2">
               <div className="w-8 h-0.5" style={{ backgroundColor: color }} />
               <span>Historical</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: color }} />
               <span>Forecast</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-4 h-4 rounded" style={{ backgroundColor: color, opacity: 0.2 }} />
               <span>Uncertainty Band</span>
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 };