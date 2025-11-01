import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Globe, GraduationCap, Heart, Zap, DollarSign, CloudRain, Wheat, Shield } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface DivisionData {
  metrics: Array<{
    domain: string;
    metric: string;
    period: string;
    value: number;
    unit?: string;
    source: string;
  }>;
  completeness: number;
}

interface CountryDeepDiveProps {
  location: {
    name: string;
    iso3: string;
    lat?: number;
    lon?: number;
  };
  profile: {
    governance?: DivisionData;
    health?: DivisionData;
    education?: DivisionData;
    energy?: DivisionData;
    finance?: DivisionData;
    population?: DivisionData;
    climate?: DivisionData;
    food?: DivisionData;
    security?: DivisionData;
  };
  completeness_overall: number;
  notes?: Array<{ division: string; note: string }>;
}

const divisionIcons = {
  governance: Activity,
  health: Heart,
  education: GraduationCap,
  energy: Zap,
  finance: DollarSign,
  population: Globe,
  climate: CloudRain,
  food: Wheat,
  security: Shield
};

const getCompletenessColor = (score: number) => {
  if (score >= 0.8) return "default";
  if (score >= 0.6) return "secondary";
  return "destructive";
};

export default function CountryDeepDive({ location, profile, completeness_overall, notes }: CountryDeepDiveProps) {
  const divisions = Object.entries(profile || {}).filter(([_, data]) => data && data.metrics && data.metrics.length > 0);

  const getLatestValue = (metrics: any[], metricName: string) => {
    if (!metrics || metrics.length === 0) return null;
    const filtered = metrics.filter(m => m && m.metric === metricName).sort((a, b) => b.period.localeCompare(a.period));
    return filtered[0]?.value;
  };

  const prepareTimeSeriesData = (metrics: any[], metricName: string) => {
    if (!metrics || metrics.length === 0) return [];
    return metrics
      .filter(m => m && m.metric === metricName)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(m => ({ period: m.period, value: m.value }));
  };

  const prepareRadarData = () => {
    const radarData = divisions.map(([division, data]) => ({
      division: division.charAt(0).toUpperCase() + division.slice(1),
      completeness: Math.round((data?.completeness || 0) * 100)
    }));
    return radarData;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">
            {location.name} ({location.iso3})
          </h1>
          <p className="text-muted-foreground mt-2">Comprehensive Country Deep-Dive Analysis</p>
        </div>
        <Badge variant={getCompletenessColor(completeness_overall)} className="text-lg px-4 py-2">
          {Math.round(completeness_overall * 100)}% Data Complete
        </Badge>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {divisions.slice(0, 5).map(([division, data]) => {
          const Icon = divisionIcons[division as keyof typeof divisionIcons];
          const latestMetric = data.metrics[0];
          return (
            <Card key={division}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4" />}
                  {division.charAt(0).toUpperCase() + division.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {latestMetric?.value?.toFixed(2) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {latestMetric?.unit || ''}
                </p>
                <Badge variant="outline" className="mt-2">
                  {Math.round(data.completeness * 100)}%
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-Domain Data Completeness</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={prepareRadarData()}>
              <PolarGrid />
              <PolarAngleAxis dataKey="division" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Completeness %" dataKey="completeness" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Division Tabs */}
      <Tabs defaultValue={divisions[0]?.[0] || 'governance'} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
          {divisions.map(([division]) => {
            const Icon = divisionIcons[division as keyof typeof divisionIcons];
            return (
              <TabsTrigger key={division} value={division} className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                <span className="hidden md:inline">{division.charAt(0).toUpperCase() + division.slice(1)}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {divisions.map(([division, data]) => {
          const uniqueMetrics = [...new Set(data.metrics.map(m => m.metric))];
          
          return (
            <TabsContent key={division} value={division} className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{division.charAt(0).toUpperCase() + division.slice(1)} Division</CardTitle>
                    <Badge variant={getCompletenessColor(data.completeness)}>
                      {Math.round(data.completeness * 100)}% Complete
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {uniqueMetrics.slice(0, 3).map(metricName => {
                    const timeSeriesData = prepareTimeSeriesData(data.metrics, metricName);
                    const latestValue = getLatestValue(data.metrics, metricName);
                    const unit = data.metrics.find(m => m.metric === metricName)?.unit || '';

                    return (
                      <div key={metricName} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            {metricName.replace(/_/g, ' ').toUpperCase()}
                          </h4>
                          <span className="text-2xl font-bold">
                            {latestValue?.toFixed(2)} {unit}
                          </span>
                        </div>
                        {timeSeriesData.length > 1 && (
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="period" />
                              <YAxis />
                              <Tooltip />
                              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    );
                  })}

                  {/* Metrics Table */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-3">All Metrics</h4>
                    <div className="space-y-2">
                      {data.metrics.slice(0, 10).map((metric, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm border-b border-border pb-2">
                          <span className="text-muted-foreground">{metric.metric.replace(/_/g, ' ')}</span>
                          <span className="font-medium">
                            {metric.value.toFixed(2)} {metric.unit || ''} <span className="text-xs text-muted-foreground">({metric.period})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Notes */}
      {notes && notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Quality Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {notes.map((note, idx) => (
                <li key={idx} className="text-sm">
                  <Badge variant="outline" className="mr-2">{note.division}</Badge>
                  {note.note}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
