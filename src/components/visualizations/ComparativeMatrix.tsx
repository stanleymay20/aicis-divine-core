import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from "lucide-react";
import { getCountryFlag } from "@/lib/geo/country-flags";
import { ALL_COUNTRIES } from "@/lib/geo/all-countries";

interface MatrixRow {
  id: string;
  label: string;
  iso2?: string;
  iso3?: string;
  metrics: Record<string, {
    value: number;
    baseline?: number;
    trend?: "up" | "down" | "stable";
    status?: "above" | "below" | "at";
    confidence?: number;
  }>;
}

interface ComparativeMatrixProps {
  rows: MatrixRow[];
  columns: string[];
  title?: string;
  showBaseline?: boolean;
  baselineLabel?: string;
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case "above": return "text-success bg-success/10";
    case "below": return "text-destructive bg-destructive/10";
    default: return "text-muted-foreground bg-muted/50";
  }
};

const getStatusIcon = (status?: string) => {
  switch (status) {
    case "above": return <CheckCircle className="h-3 w-3" />;
    case "below": return <AlertTriangle className="h-3 w-3" />;
    default: return <Minus className="h-3 w-3" />;
  }
};

const getTrendIcon = (trend?: string) => {
  if (trend === "up") return <TrendingUp className="h-3 w-3" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3" />;
  return null;
};

export const ComparativeMatrix = ({
  rows,
  columns,
  title,
  showBaseline = true,
  baselineLabel = "Regional Avg"
}: ComparativeMatrixProps) => {
  return (
    <Card>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Gap analysis showing performance vs {baselineLabel}
          </p>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Country</th>
                {columns.map(col => (
                  <th key={col} className="text-center py-2 px-3 font-medium capitalize">
                    {col.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const country = ALL_COUNTRIES.find(c => c.iso3 === row.iso3 || c.iso2 === row.iso2);
                const flag = getCountryFlag(row.iso2 || country?.iso2 || "");
                
                return (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {flag && <span className="text-lg">{flag}</span>}
                        <span className="font-medium">{row.label}</span>
                      </div>
                    </td>
                    {columns.map(col => {
                      const metric = row.metrics[col];
                      if (!metric) {
                        return (
                          <td key={col} className="text-center py-3 px-3 text-muted-foreground">
                            —
                          </td>
                        );
                      }
                      
                      const gap = metric.baseline 
                        ? ((metric.value - metric.baseline) / metric.baseline * 100)
                        : 0;
                      
                      return (
                        <td key={col} className="text-center py-3 px-3">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <span className="font-medium">
                                {metric.value.toFixed(1)}
                              </span>
                              {getTrendIcon(metric.trend)}
                            </div>
                            
                            {showBaseline && metric.baseline && (
                              <div className={`
                                flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                                ${getStatusColor(metric.status)}
                              `}>
                                {getStatusIcon(metric.status)}
                                <span>
                                  {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
                                </span>
                              </div>
                            )}
                            
                            {metric.confidence !== undefined && (
                              <div className="w-full max-w-[60px] h-1 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${Math.min(metric.confidence * 100, 95)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-success/10 text-success">
              <CheckCircle className="h-3 w-3" />
              <span>Above baseline</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              <span>Below baseline</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <div className="w-8 h-1 bg-primary rounded-full" />
            <span>Confidence level</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
