import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Calendar, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface DayRow { metric: string; day: string; count: number }

const EXPECTED_DAILY = { snapshots: 1629, forecasts: 1629, calibration: 5400, vulnerability: 200 };
const METRIC_LABELS: Record<string, string> = { snapshots: 'Performance Snapshots', forecasts: 'Forecast Archive', calibration: 'Calibration Metrics', vulnerability: 'Vulnerability Scores' };

function compoundingScore(rows: DayRow[]): number {
  const snapshotRows = rows.filter(r => r.metric === 'snapshots').sort((a, b) => a.day.localeCompare(b.day));
  if (snapshotRows.length < 2) return 0;
  const last30 = snapshotRows.slice(-30);
  let consecutive = 1;
  for (let i = 1; i < last30.length; i++) {
    const prev = new Date(last30[i - 1].day);
    const curr = new Date(last30[i].day);
    if ((curr.getTime() - prev.getTime()) / 86400000 === 1) {
      consecutive++;
    } else {
      consecutive = 1;
    }
  }
  const continuity = consecutive / Math.min(last30.length, 30);
  const avgDaily = last30.reduce((s, r) => s + r.count, 0) / Math.max(last30.length, 1);
  const volumeScore = Math.min(avgDaily / EXPECTED_DAILY.snapshots, 1);
  return Math.round((continuity * 0.6 + volumeScore * 0.4) * 100);
}

export default function AccumulationPanel() {
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('daily_accumulation')
        .select('*')
        .order('day', { ascending: false })
        .limit(120);

      if (!error && data) {
        setRows(data as DayRow[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return null;

  const score = compoundingScore(rows);
  const metrics = ['snapshots', 'forecasts', 'calibration', 'vulnerability'] as const;
  const days = Array.from(new Set(rows.map(r => r.day))).sort().reverse().slice(0, 14);
  const allDaysSorted = Array.from(new Set(rows.filter(r => r.metric === 'snapshots').map(r => r.day))).sort();

  const getCount = (metric: string, day: string) => rows.find(r => r.metric === metric && r.day === day)?.count || 0;

  const totalSnapshots = rows.filter(r => r.metric === 'snapshots').reduce((s, r) => s + r.count, 0);
  const totalForecasts = rows.filter(r => r.metric === 'forecasts').reduce((s, r) => s + r.count, 0);
  const totalCalibration = rows.filter(r => r.metric === 'calibration').reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      <Card className="p-6 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold font-orbitron">30-Day Compounding Health</h3>
              <p className="text-xs text-muted-foreground">Continuity × 0.6 + Volume × 0.4 — DB-aggregated</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {score >= 80 ? <CheckCircle className="h-5 w-5 text-success" /> : <AlertTriangle className="h-5 w-5 text-warning" />}
            <span className={cn("text-3xl font-orbitron font-bold", score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive")}>
              {score}%
            </span>
          </div>
        </div>
        <Progress value={score} className="h-3" />
      </Card>

      {allDaysSorted.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Active Days</span>
            </div>
            <span className="text-xl font-orbitron font-bold">{allDaysSorted.length}</span>
            <p className="text-[10px] text-muted-foreground">{allDaysSorted[0]} → {allDaysSorted[allDaysSorted.length - 1]}</p>
          </Card>
          <Card className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Snapshots</span>
            </div>
            <span className="text-xl font-orbitron font-bold">{totalSnapshots.toLocaleString()}</span>
          </Card>
          <Card className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-secondary" />
              <span className="text-xs text-muted-foreground">Forecasts</span>
            </div>
            <span className="text-xl font-orbitron font-bold">{totalForecasts.toLocaleString()}</span>
          </Card>
          <Card className="p-4 bg-card/50">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Calibration</span>
            </div>
            <span className="text-xl font-orbitron font-bold">{totalCalibration.toLocaleString()}</span>
          </Card>
        </div>
      )}

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
                      const expected = EXPECTED_DAILY[m];
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
