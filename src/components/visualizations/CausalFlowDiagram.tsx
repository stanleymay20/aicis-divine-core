 import { useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { ArrowRight, Zap, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
 
 interface CausalLink {
   source: string;
   target: string;
   strength: number; // 0-1
   direction: "positive" | "negative" | "neutral";
   confidence?: number;
   description?: string;
 }
 
 interface CausalNode {
   id: string;
   label: string;
   domain?: string;
   riskLevel?: "low" | "medium" | "high" | "critical";
   value?: number;
 }
 
 interface CausalFlowDiagramProps {
   nodes: CausalNode[];
   links: CausalLink[];
   title?: string;
 }
 
 const getDomainColor = (domain?: string) => {
   const colors: Record<string, string> = {
     energy: "bg-blue-500",
     finance: "bg-cyan-500",
     governance: "bg-purple-500",
     health: "bg-green-500",
     food: "bg-amber-500",
     security: "bg-red-500",
     population: "bg-pink-500",
     climate: "bg-teal-500",
   };
   return colors[domain || ""] || "bg-gray-500";
 };
 
 const getRiskBorder = (risk?: string) => {
   switch (risk) {
     case "critical": return "ring-2 ring-red-500";
     case "high": return "ring-2 ring-orange-500";
     case "medium": return "ring-1 ring-yellow-500";
     default: return "";
   }
 };
 
 export const CausalFlowDiagram = ({ nodes, links, title }: CausalFlowDiagramProps) => {
   // Group nodes by domain/layer for left-to-right flow
   const layers = useMemo(() => {
     // Simple layering: sources first, targets last, middle in between
     const sourceIds = new Set(links.map(l => l.source));
     const targetIds = new Set(links.map(l => l.target));
     
     const sources = nodes.filter(n => sourceIds.has(n.id) && !targetIds.has(n.id));
     const targets = nodes.filter(n => targetIds.has(n.id) && !sourceIds.has(n.id));
     const middle = nodes.filter(n => sourceIds.has(n.id) && targetIds.has(n.id));
     
     // If simple layering doesn't work, distribute evenly
     if (sources.length === 0 && targets.length === 0) {
       const third = Math.ceil(nodes.length / 3);
       return [
         nodes.slice(0, third),
         nodes.slice(third, third * 2),
         nodes.slice(third * 2)
       ];
     }
     
     return [sources, middle, targets].filter(l => l.length > 0);
   }, [nodes, links]);
 
   const getLinkStyle = (link: CausalLink) => {
     const opacity = Math.min(0.3 + link.strength * 0.7, 1);
     const color = link.direction === "positive" 
       ? `rgba(34, 197, 94, ${opacity})`
       : link.direction === "negative"
       ? `rgba(239, 68, 68, ${opacity})`
       : `rgba(156, 163, 175, ${opacity})`;
     return { borderColor: color, opacity };
   };
 
   return (
     <Card>
       {title && (
         <CardHeader className="pb-2">
           <CardTitle className="text-base flex items-center gap-2">
             <Zap className="h-4 w-4" />
             {title}
           </CardTitle>
           <p className="text-xs text-muted-foreground">
             Shows cause-effect relationships between domains
           </p>
         </CardHeader>
       )}
       <CardContent>
         <div className="flex items-stretch justify-between gap-4 min-h-[200px] overflow-x-auto py-4">
           {layers.map((layer, layerIdx) => (
             <div key={layerIdx} className="flex flex-col gap-4 justify-center min-w-[120px]">
               {layer.map((node) => {
                 const outLinks = links.filter(l => l.source === node.id);
                 const inLinks = links.filter(l => l.target === node.id);
                 
                 return (
                   <TooltipProvider key={node.id}>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <div 
                           className={`
                             relative p-3 rounded-lg border bg-card cursor-pointer
                             transition-all hover:shadow-md
                             ${getRiskBorder(node.riskLevel)}
                           `}
                         >
                           {/* Domain indicator */}
                           <div className={`absolute -top-1 -left-1 w-3 h-3 rounded-full ${getDomainColor(node.domain)}`} />
                           
                           <div className="text-sm font-medium">{node.label}</div>
                           {node.value !== undefined && (
                             <div className="text-xs text-muted-foreground mt-1">
                               {node.value.toFixed(1)}
                             </div>
                           )}
                           
                           {/* Outgoing arrows */}
                           {layerIdx < layers.length - 1 && outLinks.length > 0 && (
                             <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                               <ArrowRight 
                                 className="h-4 w-4"
                                 style={{ color: getLinkStyle(outLinks[0]).borderColor }}
                               />
                             </div>
                           )}
 
                           {/* Risk indicator */}
                           {node.riskLevel === "critical" || node.riskLevel === "high" ? (
                             <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-orange-500" />
                           ) : null}
                         </div>
                       </TooltipTrigger>
                       <TooltipContent className="max-w-xs">
                         <div className="space-y-2">
                           <p className="font-semibold">{node.label}</p>
                           {node.domain && (
                             <Badge variant="outline" className="capitalize">{node.domain}</Badge>
                           )}
                           {outLinks.length > 0 && (
                             <div className="text-xs">
                               <p className="font-medium">Affects:</p>
                               {outLinks.map((l, i) => (
                                 <div key={i} className="flex items-center gap-1 ml-2">
                                   {l.direction === "positive" ? (
                                     <TrendingUp className="h-3 w-3 text-green-500" />
                                   ) : l.direction === "negative" ? (
                                     <TrendingDown className="h-3 w-3 text-red-500" />
                                   ) : null}
                                   <span>{nodes.find(n => n.id === l.target)?.label}</span>
                                   <span className="text-muted-foreground">
                                     ({Math.round(l.strength * 100)}%)
                                   </span>
                                 </div>
                               ))}
                             </div>
                           )}
                           {inLinks.length > 0 && (
                             <div className="text-xs">
                               <p className="font-medium">Influenced by:</p>
                               {inLinks.map((l, i) => (
                                 <div key={i} className="ml-2">
                                   {nodes.find(n => n.id === l.source)?.label}
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                       </TooltipContent>
                     </Tooltip>
                   </TooltipProvider>
                 );
               })}
             </div>
           ))}
         </div>
 
         {/* Legend */}
         <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground border-t pt-4">
           <div className="flex items-center gap-1">
             <TrendingUp className="h-3 w-3 text-green-500" />
             <span>Positive effect</span>
           </div>
           <div className="flex items-center gap-1">
             <TrendingDown className="h-3 w-3 text-red-500" />
             <span>Negative effect</span>
           </div>
           <div className="flex items-center gap-1">
             <div className="w-2 h-2 rounded-full ring-2 ring-orange-500" />
             <span>High risk</span>
           </div>
         </div>
       </CardContent>
     </Card>
   );
 };