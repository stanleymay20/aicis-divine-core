import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CausalLink {
  source: string;
  target: string;
  strength: number;
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
    energy: "bg-primary",
    finance: "bg-accent",
    governance: "bg-secondary",
    health: "bg-success",
    food: "bg-warning",
    security: "bg-destructive",
    population: "bg-primary/70",
    climate: "bg-accent/70",
  };
  return colors[domain || ""] || "bg-muted-foreground";
};

const getRiskBorder = (risk?: string) => {
  switch (risk) {
    case "critical": return "ring-2 ring-destructive";
    case "high": return "ring-2 ring-warning";
    case "medium": return "ring-1 ring-warning/50";
    default: return "";
  }
};

export const CausalFlowDiagram = ({ nodes, links, title }: CausalFlowDiagramProps) => {
  const layers = useMemo(() => {
    const sourceIds = new Set(links.map(l => l.source));
    const targetIds = new Set(links.map(l => l.target));
    
    const sources = nodes.filter(n => sourceIds.has(n.id) && !targetIds.has(n.id));
    const targets = nodes.filter(n => targetIds.has(n.id) && !sourceIds.has(n.id));
    const middle = nodes.filter(n => sourceIds.has(n.id) && targetIds.has(n.id));
    
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

  const getLinkColor = (link: CausalLink) => {
    if (link.direction === "positive") return "text-success";
    if (link.direction === "negative") return "text-destructive";
    return "text-muted-foreground";
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
                          <div className={`absolute -top-1 -left-1 w-3 h-3 rounded-full ${getDomainColor(node.domain)}`} />
                          
                          <div className="text-sm font-medium">{node.label}</div>
                          {node.value !== undefined && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {node.value.toFixed(1)}
                            </div>
                          )}
                          
                          {layerIdx < layers.length - 1 && outLinks.length > 0 && (
                            <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                              <ArrowRight className={`h-4 w-4 ${getLinkColor(outLinks[0])}`} />
                            </div>
                          )}

                          {(node.riskLevel === "critical" || node.riskLevel === "high") && (
                            <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-warning" />
                          )}
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
                                    <TrendingUp className="h-3 w-3 text-success" />
                                  ) : l.direction === "negative" ? (
                                    <TrendingDown className="h-3 w-3 text-destructive" />
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

        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground border-t pt-4">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-success" />
            <span>Positive effect</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-destructive" />
            <span>Negative effect</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full ring-2 ring-warning" />
            <span>High risk</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
