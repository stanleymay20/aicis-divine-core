 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from "lucide-react";
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
 
 interface RiskCell {
   domain: string;
   severity: number; // 1-5
   likelihood: number; // 1-5
   label?: string;
   trend?: "up" | "down" | "stable";
   confidence?: number;
 }
 
 interface RiskHeatmapProps {
   data: RiskCell[];
   title?: string;
   showLegend?: boolean;
 }
 
 const SEVERITY_LABELS = ["Minimal", "Minor", "Moderate", "Major", "Severe"];
 const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
 
 const getRiskScore = (severity: number, likelihood: number) => severity * likelihood;
 
 const getRiskColor = (score: number) => {
   if (score >= 20) return "bg-red-600";
   if (score >= 15) return "bg-red-500";
   if (score >= 10) return "bg-orange-500";
   if (score >= 5) return "bg-yellow-500";
   return "bg-green-500";
 };
 
 const getRiskLabel = (score: number) => {
   if (score >= 20) return "Critical";
   if (score >= 15) return "High";
   if (score >= 10) return "Medium";
   if (score >= 5) return "Low";
   return "Minimal";
 };
 
 const getTrendIcon = (trend?: string) => {
   if (trend === "up") return <TrendingUp className="h-3 w-3 text-red-500" />;
   if (trend === "down") return <TrendingDown className="h-3 w-3 text-green-500" />;
   return <Minus className="h-3 w-3 text-muted-foreground" />;
 };
 
 export const RiskHeatmap = ({ data, title, showLegend = true }: RiskHeatmapProps) => {
   // Create 5x5 matrix
   const matrix: (RiskCell | null)[][] = Array(5).fill(null).map(() => Array(5).fill(null));
   
   // Place data in matrix based on severity (x) and likelihood (y)
   data.forEach(cell => {
     const x = Math.min(Math.max(Math.round(cell.severity) - 1, 0), 4);
     const y = Math.min(Math.max(Math.round(cell.likelihood) - 1, 0), 4);
     matrix[4 - y][x] = cell; // Invert Y so higher likelihood is at top
   });
 
   return (
     <Card>
       {title && (
         <CardHeader className="pb-2">
           <CardTitle className="text-base flex items-center gap-2">
             <AlertTriangle className="h-4 w-4" />
             {title}
           </CardTitle>
         </CardHeader>
       )}
       <CardContent>
         <div className="overflow-x-auto">
           <div className="min-w-[400px]">
             {/* Y-axis label */}
             <div className="flex">
               <div className="w-24 flex items-center justify-center">
                 <span className="text-xs font-medium text-muted-foreground -rotate-90 whitespace-nowrap">
                   LIKELIHOOD →
                 </span>
               </div>
               <div className="flex-1">
                 {/* Matrix */}
                 <div className="grid grid-cols-5 gap-1">
                   {matrix.map((row, rowIdx) => (
                     row.map((cell, colIdx) => {
                       const baseScore = (5 - rowIdx) * (colIdx + 1);
                       const bgColor = getRiskColor(baseScore);
                       
                       return (
                         <TooltipProvider key={`${rowIdx}-${colIdx}`}>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <div 
                                 className={`
                                   aspect-square rounded-md flex flex-col items-center justify-center p-1
                                   ${bgColor} text-white transition-all cursor-pointer
                                   ${cell ? 'ring-2 ring-white ring-offset-2 ring-offset-background' : 'opacity-40'}
                                 `}
                               >
                                 {cell && (
                                   <>
                                     <span className="text-[10px] font-bold truncate max-w-full px-1">
                                       {cell.domain.slice(0, 4)}
                                     </span>
                                     <div className="flex items-center gap-0.5">
                                       {getTrendIcon(cell.trend)}
                                     </div>
                                   </>
                                 )}
                               </div>
                             </TooltipTrigger>
                             <TooltipContent className="p-3">
                               {cell ? (
                                 <div className="space-y-1">
                                   <p className="font-semibold">{cell.domain}</p>
                                   <p className="text-sm">
                                     Risk: <Badge variant="outline">{getRiskLabel(getRiskScore(cell.severity, cell.likelihood))}</Badge>
                                   </p>
                                   <p className="text-xs text-muted-foreground">
                                     Severity: {SEVERITY_LABELS[Math.round(cell.severity) - 1]} ({cell.severity})
                                   </p>
                                   <p className="text-xs text-muted-foreground">
                                     Likelihood: {LIKELIHOOD_LABELS[Math.round(cell.likelihood) - 1]} ({cell.likelihood})
                                   </p>
                                   {cell.confidence && (
                                     <p className="text-xs text-muted-foreground">
                                       Confidence: {Math.round(cell.confidence * 100)}%
                                     </p>
                                   )}
                                 </div>
                               ) : (
                                 <p className="text-sm text-muted-foreground">
                                   {LIKELIHOOD_LABELS[4 - rowIdx]} × {SEVERITY_LABELS[colIdx]}
                                 </p>
                               )}
                             </TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                       );
                     })
                   ))}
                 </div>
 
                 {/* X-axis labels */}
                 <div className="grid grid-cols-5 gap-1 mt-2">
                   {SEVERITY_LABELS.map((label, idx) => (
                     <div key={idx} className="text-center text-[10px] text-muted-foreground">
                       {label}
                     </div>
                   ))}
                 </div>
                 <div className="text-center text-xs font-medium text-muted-foreground mt-1">
                   SEVERITY →
                 </div>
               </div>
             </div>
 
             {/* Y-axis labels */}
             <div className="flex mt-2">
               <div className="w-24 grid grid-rows-5 gap-1">
                 {LIKELIHOOD_LABELS.slice().reverse().map((label, idx) => (
                   <div key={idx} className="flex items-center justify-end pr-2 text-[10px] text-muted-foreground h-8">
                     {label}
                   </div>
                 ))}
               </div>
             </div>
           </div>
         </div>
 
         {showLegend && (
           <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
             {[
               { label: "Critical", color: "bg-red-600" },
               { label: "High", color: "bg-red-500" },
               { label: "Medium", color: "bg-orange-500" },
               { label: "Low", color: "bg-yellow-500" },
               { label: "Minimal", color: "bg-green-500" },
             ].map(item => (
               <div key={item.label} className="flex items-center gap-1">
                 <div className={`w-3 h-3 rounded ${item.color}`} />
                 <span className="text-xs text-muted-foreground">{item.label}</span>
               </div>
             ))}
           </div>
         )}
       </CardContent>
     </Card>
   );
 };