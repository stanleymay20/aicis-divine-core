 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info } from "lucide-react";
 import { LineChart, Line, ResponsiveContainer } from "recharts";
 
 interface ScorecardMetric {
   label: string;
   value: number;
   unit?: string;
   delta?: number; // 3-6 month change
   deltaLabel?: string;
   riskLevel?: "low" | "medium" | "high" | "critical";
   confidence?: number; // 0-1, max 0.95
   sparklineData?: { value: number }[];
   domain?: string;
 }
 
 interface ExecutiveScorecardProps {
   metrics: ScorecardMetric[];
   title?: string;
   columns?: 2 | 3 | 4 | 5;
 }
 
 const getRiskColor = (risk: string) => {
   switch (risk) {
     case "critical": return "text-red-500 bg-red-500/10";
     case "high": return "text-orange-500 bg-orange-500/10";
     case "medium": return "text-yellow-500 bg-yellow-500/10";
     default: return "text-green-500 bg-green-500/10";
   }
 };
 
 const getRiskIcon = (risk: string) => {
   switch (risk) {
     case "critical":
     case "high": return <AlertTriangle className="h-4 w-4" />;
     case "medium": return <Info className="h-4 w-4" />;
     default: return <CheckCircle className="h-4 w-4" />;
   }
 };
 
 const getDeltaIcon = (delta: number) => {
   if (delta > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
   if (delta < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
   return <Minus className="h-3 w-3 text-muted-foreground" />;
 };
 
 export const ExecutiveScorecard = ({ metrics, title, columns = 4 }: ExecutiveScorecardProps) => {
   const gridCols = {
     2: "grid-cols-1 sm:grid-cols-2",
     3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
     4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
     5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
   };
 
   return (
     <div className="space-y-4">
       {title && <h3 className="text-lg font-semibold">{title}</h3>}
       <div className={`grid ${gridCols[columns]} gap-4`}>
         {metrics.map((metric, idx) => (
           <Card key={idx} className="relative overflow-hidden">
             {/* Confidence shading - lighter = lower confidence */}
             <div 
               className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"
               style={{ opacity: metric.confidence || 0.5 }}
             />
             
             <CardContent className="pt-4 relative">
               {/* Header with risk indicator */}
               <div className="flex items-center justify-between mb-2">
                 <span className="text-sm font-medium text-muted-foreground">
                   {metric.label}
                 </span>
                 {metric.riskLevel && (
                   <div className={`p-1 rounded-full ${getRiskColor(metric.riskLevel)}`}>
                     {getRiskIcon(metric.riskLevel)}
                   </div>
                 )}
               </div>
 
               {/* Main value */}
               <div className="flex items-end gap-2 mb-2">
                 <span className="text-2xl font-bold">
                   {typeof metric.value === "number" 
                     ? metric.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                     : metric.value}
                 </span>
                 {metric.unit && (
                   <span className="text-sm text-muted-foreground mb-1">{metric.unit}</span>
                 )}
               </div>
 
               {/* Delta indicator */}
               {metric.delta !== undefined && (
                 <div className="flex items-center gap-1 mb-2">
                   {getDeltaIcon(metric.delta)}
                   <span className={`text-xs ${metric.delta > 0 ? 'text-green-500' : metric.delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                     {metric.delta > 0 ? '+' : ''}{metric.delta.toFixed(1)}%
                   </span>
                   <span className="text-xs text-muted-foreground">
                     {metric.deltaLabel || "vs 6mo ago"}
                   </span>
                 </div>
               )}
 
               {/* Sparkline trend */}
               {metric.sparklineData && metric.sparklineData.length > 1 && (
                 <div className="h-8 mt-2">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={metric.sparklineData}>
                       <Line 
                         type="monotone" 
                         dataKey="value" 
                         stroke="hsl(var(--primary))"
                         strokeWidth={1.5}
                         dot={false}
                       />
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
               )}
 
               {/* Confidence indicator */}
               {metric.confidence !== undefined && (
                 <div className="flex items-center gap-2 mt-2">
                   <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                     <div 
                       className="h-full bg-primary rounded-full transition-all"
                       style={{ width: `${Math.min(metric.confidence * 100, 95)}%` }}
                     />
                   </div>
                   <span className="text-xs text-muted-foreground">
                     {Math.min(Math.round(metric.confidence * 100), 95)}%
                   </span>
                 </div>
               )}
             </CardContent>
           </Card>
         ))}
       </div>
     </div>
   );
 };