import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Database, FileCheck, Globe, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MicrodataRegistry = () => {
  const navigate = useNavigate();

  const { data: sources } = useQuery({
    queryKey: ["microdata-sources"],
    queryFn: async () => {
      const { data } = await supabase
        .from("microdata_sources")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: indicatorStats } = useQuery({
    queryKey: ["microdata-indicator-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("microdata_indicators")
        .select("domain, country_iso3, source_id");
      const domains = new Set((data || []).map(d => d.domain));
      const countries = new Set((data || []).map(d => d.country_iso3));
      return {
        totalIndicators: data?.length || 0,
        domains: domains.size,
        countries: countries.size,
      };
    },
  });

  const totalSources = sources?.length || 0;
  const publicUse = sources?.filter(s => s.license_type === "public-use").length || 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Microdata Governance Registry
            </h1>
            <p className="text-muted-foreground mt-1">
              Public-use survey microdata — aggregated before exposure, never person-level
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        </div>

        {/* Governance Banner */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">Data Governance Standard</p>
              <ul className="text-muted-foreground space-y-0.5">
                <li>• <strong>Public-use only</strong> — No restricted or confidential datasets are ingested automatically</li>
                <li>• <strong>Aggregated before storage</strong> — Individual-level records are never stored or displayed</li>
                <li>• <strong>License tracked</strong> — Every source has documented access type and provenance</li>
                <li>• <strong>GDPR-aligned</strong> — No personal data processed; all outputs are statistical aggregates</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalSources}</p>
              <p className="text-xs text-muted-foreground">Registered Sources</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{publicUse}</p>
              <p className="text-xs text-muted-foreground">Public-Use Verified</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{indicatorStats?.totalIndicators || 0}</p>
              <p className="text-xs text-muted-foreground">Aggregated Indicators</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{indicatorStats?.countries || 0}</p>
              <p className="text-xs text-muted-foreground">Countries Covered</p>
            </CardContent>
          </Card>
        </div>

        {/* Source Registry Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Source Registry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Year(s)</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Indicators</TableHead>
                  <TableHead>De-identification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium max-w-[300px] truncate" title={s.title || ""}>
                      {s.title || s.source_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {s.provider === "worldbank_microdata" ? "World Bank" : s.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        {(s.countries as string[])?.join(", ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(s.years as number[])?.join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={s.license_type === "public-use" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        <Lock className="h-3 w-3 mr-1" />
                        {s.license_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={s.status === "aggregated" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{s.indicator_count || 0}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">
                        {s.deidentification_status === "fully_deidentified" ? "Fully De-identified" : s.deidentification_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!sources || sources.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No microdata sources registered yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Aggregation Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aggregation Policy</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              All microdata ingested into AICIS is aggregated to national or subnational level before storage.
              No individual survey responses, household records, or person-level observations are retained in the system.
            </p>
            <p>
              Indicators stored represent domain-level coverage metrics derived from survey variable metadata.
              This approach provides analytical depth while maintaining full compliance with data provider terms
              and privacy regulations.
            </p>
            <p className="text-xs italic">
              Sources: World Bank Microdata Library (public-use datasets only).
              Additional providers (IPUMS, DHS) available via governed registration process.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MicrodataRegistry;
