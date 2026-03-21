import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, FileCheck, Calendar } from "lucide-react";

interface MicrodataEnrichmentBadgeProps {
  countryName: string;
  className?: string;
}

export const MicrodataEnrichmentBadge = ({ countryName, className }: MicrodataEnrichmentBadgeProps) => {
  const { data: sources } = useQuery({
    queryKey: ["microdata-enrichment", countryName],
    queryFn: async () => {
      const { data } = await supabase
        .from("microdata_sources")
        .select("source_name, countries, years, indicator_count, license_type, status")
        .eq("status", "aggregated");
      // Filter by country name match in the countries array
      return (data || []).filter((s: any) =>
        Array.isArray(s.countries) && s.countries.some((c: string) =>
          c.toLowerCase() === countryName.toLowerCase()
        )
      );
    },
  });

  if (!sources || sources.length === 0) return null;

  const totalIndicators = sources.reduce((sum: number, s: any) => sum + (s.indicator_count || 0), 0);
  const years = [...new Set(sources.flatMap((s: any) => s.years || []))].sort();

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className || ""}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" />
          Microdata Enrichment Active
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] gap-1">
            <FileCheck className="h-2.5 w-2.5" />
            {totalIndicators} indicators from {sources.length} surveys
          </Badge>
          {years.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {years[0]}–{years[years.length - 1]}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">Public-Use Only</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Survey microdata aggregated to national level. Sources: World Bank Microdata Library. All datasets are public-use, de-identified, and pre-aggregated before exposure.
        </p>
      </CardContent>
    </Card>
  );
};
