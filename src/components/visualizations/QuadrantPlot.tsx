 import { useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { 
   ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, 
   Tooltip, ResponsiveContainer, ReferenceLine, ZAxis, Cell
 } from "recharts";
 import { getCountryFlag } from "@/lib/geo/country-flags";
 import { ALL_COUNTRIES } from "@/lib/geo/all-countries";
 
 interface QuadrantDataPoint {
   id: string;
   label: string;
   x: number;
   y: number;
   size?: number;
   iso2?: string;
   iso3?: string;
   category?: string;
 }
 
 interface QuadrantPlotProps {
   data: QuadrantDataPoint[];
   title?: string;
   xLabel?: string;
   yLabel?: string;
   quadrantLabels?: {
     topLeft?: string;
     topRight?: string;
     bottomLeft?: string;
     bottomRight?: string;
   };
   showFlags?: boolean;
   height?: number;
 }
 
 const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
 
 const CustomTooltip = ({ active, payload }: any) => {
   if (!active || !payload || !payload.length) return null;
   const point = payload[0]?.payload;
   const country = ALL_COUNTRIES.find(c => c.iso3 === point.iso3 || c.iso2 === point.iso2);
   const flag = getCountryFlag(point.iso2 || country?.iso2 || "");
   
   return (
     <div className="bg-card border rounded-lg shadow-lg p-3">
       <div className="flex items-center gap-2 mb-2">
         {flag && <span className="text-xl">{flag}</span>}
         <span className="font-semibold">{point.label}</span>
       </div>
       <div className="space-y-1 text-sm">
         <p>X: <span className="font-medium">{point.x?.toFixed(2)}</span></p>
         <p>Y: <span className="font-medium">{point.y?.toFixed(2)}</span></p>
         {point.category && (
           <Badge variant="outline" className="mt-1">{point.category}</Badge>
         )}
       </div>
     </div>
   );
 };
 
 export const QuadrantPlot = ({
   data,
   title,
   xLabel = "X Axis",
   yLabel = "Y Axis",
   quadrantLabels,
   showFlags = true,
   height = 400
 }: QuadrantPlotProps) => {
   // Calculate midpoints for quadrant lines
   const bounds = useMemo(() => {
     if (!data.length) return { xMid: 50, yMid: 50, xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
     
     const xVals = data.map(d => d.x);
     const yVals = data.map(d => d.y);
     
     return {
       xMin: Math.min(...xVals) * 0.9,
       xMax: Math.max(...xVals) * 1.1,
       yMin: Math.min(...yVals) * 0.9,
       yMax: Math.max(...yVals) * 1.1,
       xMid: (Math.min(...xVals) + Math.max(...xVals)) / 2,
       yMid: (Math.min(...yVals) + Math.max(...yVals)) / 2,
     };
   }, [data]);
 
   const CustomDot = (props: any) => {
     const { cx, cy, payload, index } = props;
     const country = ALL_COUNTRIES.find(c => c.iso3 === payload.iso3 || c.iso2 === payload.iso2);
     const flag = showFlags ? getCountryFlag(payload.iso2 || country?.iso2 || "") : null;
     
     if (!cx || !cy) return null;
     
     return (
       <g>
         <circle
           cx={cx}
           cy={cy}
           r={payload.size ? Math.sqrt(payload.size) * 3 : 8}
           fill={COLORS[index % COLORS.length]}
           fillOpacity={0.7}
           stroke={COLORS[index % COLORS.length]}
           strokeWidth={2}
         />
         {showFlags && flag ? (
           <text
             x={cx}
             y={cy}
             textAnchor="middle"
             dominantBaseline="central"
             fontSize={12}
           >
             {flag}
           </text>
         ) : (
           <text
             x={cx}
             y={cy + 20}
             textAnchor="middle"
             fill="currentColor"
             fontSize={10}
           >
             {payload.label?.slice(0, 3)}
           </text>
         )}
       </g>
     );
   };
 
   return (
     <Card>
       {title && (
         <CardHeader className="pb-2">
           <CardTitle className="text-base">{title}</CardTitle>
           <p className="text-xs text-muted-foreground">
             Position reflects relative performance across two dimensions
           </p>
         </CardHeader>
       )}
       <CardContent>
         <ResponsiveContainer width="100%" height={height}>
           <ScatterChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
             <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
             <XAxis 
               type="number" 
               dataKey="x" 
               domain={[bounds.xMin, bounds.xMax]}
               tick={{ fill: 'currentColor', fontSize: 11 }}
               label={{ value: xLabel, position: 'bottom', fill: 'currentColor', fontSize: 12 }}
             />
             <YAxis 
               type="number" 
               dataKey="y"
               domain={[bounds.yMin, bounds.yMax]}
               tick={{ fill: 'currentColor', fontSize: 11 }}
               label={{ value: yLabel, angle: -90, position: 'left', fill: 'currentColor', fontSize: 12 }}
             />
             <ZAxis dataKey="size" range={[50, 400]} />
             <Tooltip content={<CustomTooltip />} />
             
             {/* Quadrant lines */}
             <ReferenceLine 
               x={bounds.xMid} 
               stroke="hsl(var(--muted-foreground))" 
               strokeDasharray="5 5"
             />
             <ReferenceLine 
               y={bounds.yMid} 
               stroke="hsl(var(--muted-foreground))" 
               strokeDasharray="5 5"
             />
 
             <Scatter
               data={data}
               shape={<CustomDot />}
             />
           </ScatterChart>
         </ResponsiveContainer>
 
         {/* Quadrant labels */}
         {quadrantLabels && (
           <div className="grid grid-cols-2 gap-4 mt-4 text-xs text-center">
             <div className="p-2 bg-muted/30 rounded">
               <span className="font-medium">{quadrantLabels.topLeft || "Top Left"}</span>
             </div>
             <div className="p-2 bg-muted/30 rounded">
               <span className="font-medium">{quadrantLabels.topRight || "Top Right"}</span>
             </div>
             <div className="p-2 bg-muted/30 rounded">
               <span className="font-medium">{quadrantLabels.bottomLeft || "Bottom Left"}</span>
             </div>
             <div className="p-2 bg-muted/30 rounded">
               <span className="font-medium">{quadrantLabels.bottomRight || "Bottom Right"}</span>
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 };