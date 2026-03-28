import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const SystemPulse = () => {
  const { data: automationHealth } = useQuery({
    queryKey: ["system-pulse"],
    queryFn: async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const { data } = await supabase
        .from("automation_logs")
        .select("job_name, status, executed_at")
        .gte("executed_at", sixHoursAgo.toISOString())
        .order("executed_at", { ascending: false })
        .limit(200);

      const jobs = new Map<string, { status: string; lastRun: string; errors: number; successes: number }>();
      for (const log of data || []) {
        if (!jobs.has(log.job_name)) {
          jobs.set(log.job_name, { status: log.status, lastRun: log.executed_at!, errors: 0, successes: 0 });
        }
        const j = jobs.get(log.job_name)!;
        if (log.status === "error" || log.status === "timeout") j.errors++;
        if (log.status === "success") j.successes++;
      }

      return Array.from(jobs.entries())
        .map(([name, info]) => ({ name, ...info }))
        .sort((a, b) => b.errors - a.errors);
    },
    staleTime: 60_000,
  });

  const healthy = automationHealth?.filter(j => j.errors === 0).length || 0;
  const total = automationHealth?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          System Pulse (6h)
          <Badge variant={healthy === total ? "default" : "secondary"} className="ml-auto text-xs">
            {healthy}/{total} healthy
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {automationHealth?.slice(0, 10).map(job => (
          <div key={job.name} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-muted/50">
            {job.errors > 0 ? (
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
            )}
            <span className="truncate flex-1 font-mono text-xs">{job.name}</span>
            {job.errors > 0 && (
              <Badge variant="destructive" className="text-[10px]">{job.errors} err</Badge>
            )}
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
