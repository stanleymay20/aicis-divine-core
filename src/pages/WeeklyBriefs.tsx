import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Calendar, Globe, BarChart3, TrendingDown, TrendingUp,
  AlertTriangle, Shield, ArrowLeft, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

interface WeeklyBrief {
  id: string;
  issue_number: number;
  brief_date: string;
  title: string;
  summary_md: string;
  sections: Record<string, any>;
  countries_covered: number;
  models_count: number;
  avg_mape: number;
  avg_confidence: number;
  metadata: Record<string, any>;
  created_at: string;
}

const WeeklyBriefs = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: briefs = [], isLoading } = useQuery({
    queryKey: ["weekly-briefs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_briefs")
        .select("*")
        .order("issue_number", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as WeeklyBrief[];
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/command">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-orbitron tracking-tight">
              Weekly Intelligence Briefs
            </h1>
            <p className="text-sm text-muted-foreground">
              Auto-generated structural risk reports from APE-V2.1
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading briefs…</div>
        ) : briefs.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No weekly briefs generated yet.</p>
              <p className="text-xs mt-1">Briefs are generated every Monday at 06:00 UTC.</p>
            </CardContent>
          </Card>
        ) : (
          briefs.map((brief) => {
            const isExpanded = expandedId === brief.id;
            const sections = brief.sections || {};

            return (
              <Card key={brief.id} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : brief.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Issue #{brief.issue_number}
                      </CardTitle>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(brief.brief_date).toLocaleDateString("en-US", {
                            weekday: "long", year: "numeric", month: "long", day: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {brief.countries_covered} countries
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {brief.models_count} models
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        MAPE {brief.avg_mape?.toFixed(1)}%
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Conf {brief.avg_confidence?.toFixed(0)}%
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-6 border-t pt-6">
                    {/* Executive Summary */}
                    {sections.executive_summary && (
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          {sections.executive_summary.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {sections.executive_summary.content}
                        </p>
                      </div>
                    )}

                    <Separator />

                    {/* Deteriorating */}
                    {sections.deteriorating?.countries?.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-destructive" />
                          {sections.deteriorating.title}
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-muted-foreground text-xs">
                                <th className="text-left py-2 pr-4">#</th>
                                <th className="text-left py-2 pr-4">Country</th>
                                <th className="text-right py-2 pr-4">Risk</th>
                                <th className="text-right py-2 pr-4">Momentum</th>
                                <th className="text-right py-2 pr-4">Fragility</th>
                                <th className="text-right py-2">Breaks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sections.deteriorating.countries.map((c: any, i: number) => (
                                <tr key={c.iso3} className="border-b border-border/50">
                                  <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                                  <td className="py-2 pr-4 font-mono font-medium">{c.iso3}</td>
                                  <td className="py-2 pr-4 text-right text-destructive">{c.risk_pressure}</td>
                                  <td className="py-2 pr-4 text-right">{c.momentum}</td>
                                  <td className="py-2 pr-4 text-right">{c.fragility}</td>
                                  <td className="py-2 text-right">{c.breaks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Improving */}
                    {sections.improving?.countries?.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-success" />
                          {sections.improving.title}
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-muted-foreground text-xs">
                                <th className="text-left py-2 pr-4">#</th>
                                <th className="text-left py-2 pr-4">Country</th>
                                <th className="text-right py-2 pr-4">Momentum</th>
                                <th className="text-right py-2 pr-4">Risk</th>
                                <th className="text-right py-2">Domains ↑</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sections.improving.countries.map((c: any, i: number) => (
                                <tr key={c.iso3} className="border-b border-border/50">
                                  <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                                  <td className="py-2 pr-4 font-mono font-medium">{c.iso3}</td>
                                  <td className="py-2 pr-4 text-right text-success">{c.momentum}</td>
                                  <td className="py-2 pr-4 text-right">{c.risk_pressure}</td>
                                  <td className="py-2 text-right">{c.domains_rising}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Confidence */}
                    {sections.confidence_assessment && (
                      <>
                        <Separator />
                        <div className="bg-muted/30 rounded-lg p-4">
                          <h3 className="font-semibold mb-2">{sections.confidence_assessment.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            Average Confidence: <strong>{sections.confidence_assessment.avg_confidence}%</strong>
                            {" · "}MAPE: <strong>{sections.confidence_assessment.mape?.toFixed?.(1) ?? sections.confidence_assessment.mape}%</strong>
                          </p>
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            {sections.confidence_assessment.note}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Methodology */}
                    {sections.methodology && (
                      <p className="text-xs text-muted-foreground/60 italic leading-relaxed">
                        {sections.methodology.content}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WeeklyBriefs;
