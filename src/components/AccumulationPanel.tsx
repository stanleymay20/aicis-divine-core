import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Calendar, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface DayRow { metric: string; day: string; count: number }
interface Totals { total_days: number; first_day: string; last_day: string; total_snapshots: number; total_forecasts: number; total_calibration: number }

const EXPECTED_DAILY = { snapshots: 1629, forecasts: 1629, calibration: 5400, vulnerability: 200 };
const METRIC_LABELS: Record<string, string> = { snapshots: 'Performance Snapshots', forecasts: 'Forecast Archive', calibration: 'Calibration Metrics', vulnerability: 'Vulnerability Scores' };

function compoundingScore(rows: DayRow[]): number {
  const days = new Set(rows.filter(r => r.metric === 'snapshots').map(r => r.day));
  const sorted = Array.from(days).sort();
  if (sorted.length < 2) return 0;
  const last30 = sorted.slice(-30);
  let consecutive = 1;
  for (let i = 1; i < last30.length; i++) {
    const prev = new Date(last30[i - 1]);
    const curr = new Date(last30[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) consecutive++;
  }
  const continuity = consecutive / Math.min(last30.length, 30);
  const avgDaily = rows.filter(r => r.metric === 'snapshots').reduce((s, r) => s + r.count, 0) / Math.max(last30.length, 1);
  const volumeScore = Math.min(avgDaily / EXPECTED_DAILY.snapshots, 1);
  return Math.round((continuity * 0.6 + volumeScore * 0.4) * 100);
}

export default function AccumulationPanel() {
  const [rows, setRows] = useState<DayRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.rpc('aggregate_country_snapshots', { _snapshot_date: new Date().toISOString().slice(0, 10) }),
      // Use raw queries via edge function or direct table reads
    ]);

    // Load daily accumulation data
    const load = async () => {
      const [accum, summary] = await Promise.all([
        supabase.from('country_performance_snapshots')
          .select('snapshot_date')
          .order('snapshot_date', { ascending: false })
          .limit(1000),
        supabase.from('country_performance_snapshots')
          .select('snapshot_date')
          .order('snapshot_date', { ascending: true })
          .limit(1),
      ]);

      // Build daily counts from snapshots
      const snapCounts: Record<string, number> = {};
      accum.data?.forEach(r => {
        const day = r.snapshot_date?.slice(0, 10);
        if (day) snapCounts[day] = (snapCounts[day] || 0) + 1;
      });

      // Also fetch forecast and calibration counts
      const [forecasts, calibration, vuln] = await Promise.all([
        supabase.from('forecast_archive').select('created_at').order('created_at', { ascending: false }).limit(1000),
        supabase.from('calibration_metrics').select('computed_at').order('computed_at', { ascending: false }).limit(1000),
        supabase.from('vulnerability_scores').select('created_at').order('created_at', { ascending: false }).limit(1000),
      ]);

      const fCounts: Record<string, number> = {};
      forecasts.data?.forEach(r => { const d = r.created_at?.slice(0, 10); if (d) fCounts[d] = (fCounts[d] || 0) + 1; });

      const cCounts: Record<string, number> = {};
      calibration.data?.forEach(r => { const d = r.computed_at?.slice(0, 10); if (d) cCounts[d] = (cCounts[d] || 0) + 1; });

      const vCounts: Record<string, number> = {};
      vuln.data?.forEach(r => { const d = r.created_at?.slice(0, 10); if (d) vCounts[d] = (vCounts[d] || 0) + 1; });

      const allRows: DayRow[] = [];
      const addMetric = (metric: string, counts: Record<string, number>) => {
        Object.entries(counts).forEach(([day, count]) => allRows.push({ metric, day, count }));
      };
      addMetric('snapshots', snapCounts);
      addMetric('forecasts', fCounts);
      addMetric('calibration', cCounts);
      addMetric('vulnerability', vCounts);

      setRows(allRows);

      const allDays = Object.keys(snapCounts).sort();
      if (allDays.length > 0) {
        setTotals({
          total_days: allDays.length,
          first_day: allDays[0],
          last_day: allDays[allDays.length - 1],
          total_snapshots: Object.values(snapCounts).reduce((a, b) => a + b, 0),
          total_forecasts: Object.values(fCounts).reduce((a, b) => a + b, 0),
          total_calibration: Object.values(cCounts).reduce((a, b) => a + b, 0),
        });
      }
    };
    load();
  }, []);

  const score = compoundingScore(rows);
  const metrics = ['snapshots', 'forecasts', 'calibration', 'vulnerability'];
  const days = Array.from(new Set(rows.map(r => r.day))).sort().reverse().slice(0, 14);

  const getCount = (metric: string, day: string) => rows.find(r => r.metric === metric && r.day === day)?.count || 0;

  return (
    <div className="space-y-4">
      {/* Compounding Health Score */}
      <Card className="p-6 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold font-orbitron">30-Day Compounding Health</h3>
              <p className="text-xs text-muted-foreground">Continuity × 0.6 + Volume × 0.4</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {score >= 80 ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
            <span className={cn("text-3xl font-orbitron font-bold", score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive")}>
              {score}%
            </span>
          </div>
        </div>
        <Progress value={score} className="h-3" />
      </Card>

      {/* Continuity Summary */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Active Days</span>
            </div>
            <span className="text-xl font-orbitron font-bold">{totals.total_days}</span>
            <p className="text-[10px] text-muted-foreground">{totals.first_day} → {totals.last_day}</p>
          </Card>
          <Card className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Snapshots</span>
            </div>
            <span className="text-xl font-orbitron font-bold">{totals.total_snapshots.toLocaleString()}</span>
          </Card>
          <Card className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-secondary" />
              <span className="text-xs text-muted-foreground">Forecasts</span>
            </div>
            <span className="text-xl font-orbitron font-bold">{totals.total_forecasts.toLocaleString()}</span>
          </Card>
          <Card className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Calibration</span>
            </div>
            <span className="text-xl font-orbitron font-bold">{totals.total_calibration.toLocaleString()}</span>
          </Card>
        </div>
      )}

      {/* Daily Growth Table */}
      <Card className="p-4 border-primary/20 overflow-hidden">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Daily Accumulation (Last 14 Days)
        </h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                {metrics.map(m => (
                  <TableHead key={m} className="text-xs text-right">{METRIC_LABELS[m]}</TableHead>
                ))}
                <TableHead className="text-xs text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map(day => {
                const snapCount = getCount('snapshots', day);
                const isHealthy = snapCount > 0;
                return (
                  <TableRow key={day}>
                    <TableCell className="text-xs font-mono">{day}</TableCell>
                    {metrics.map(m => {
                      const c = getCount(m, day);
                      const expected = EXPECTED_DAILY[m as keyof typeof EXPECTED_DAILY];
                      return (
                        <TableCell key={m} className="text-xs text-right">
                          <span className={cn(
                            c === 0 ? "text-muted-foreground" : c >= expected * 0.8 ? "text-success" : "text-warning"
                          )}>
                            {c > 0 ? c.toLocaleString() : '—'}
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      <Badge variant={isHealthy ? "default" : "destructive"} className="text-[10px]">
                        {isHealthy ? '✓' : 'MISS'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
