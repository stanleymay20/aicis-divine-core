import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AutomationLog {
  id: string;
  job_name: string;
  status: "running" | "success" | "error";
  message: string;
  executed_at: string;
}

export function AutomationMonitorPanel() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("automation_logs")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setLogs((data || []) as AutomationLog[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  const runJob = async (jobName: string) => {
    setRunning(jobName);
    try {
      const { error } = await supabase.functions.invoke(jobName, { body: {} });
      
      if (error) throw error;

      toast({
        title: "Job Started",
        description: `${jobName} has been triggered successfully`,
      });
      
      setTimeout(fetchLogs, 2000);
    } catch (e) {
      toast({
        title: "Error",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setRunning(null);
    }
  };

  const jobButtons = [
    { name: "cron-hourly-rewards", label: "Award Rewards" },
    { name: "cron-daily-mint", label: "Mint SC" },
    { name: "cron-6h-partner-sync", label: "Sync Partners" },
    { name: "cron-hourly-dao-tally", label: "Tally DAO" },
  ];

  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Automation Monitor
        </CardTitle>
        <CardDescription>System automation jobs and cron schedules</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manual Triggers */}
        <div className="grid grid-cols-2 gap-2">
          {jobButtons.map((job) => (
            <Button
              key={job.name}
              variant="outline"
              size="sm"
              onClick={() => runJob(job.name)}
              disabled={running !== null}
              className="gap-2"
            >
              {running === job.name ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {job.label}
            </Button>
          ))}
        </div>

        {/* Logs */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No logs yet</p>
          ) : (
            logs.map((log) => (
              <Card key={log.id} className="border-primary/10">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {log.status === "success" && (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    )}
                    {log.status === "error" && (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    {log.status === "running" && (
                      <Loader2 className="h-5 w-5 text-yellow-500 animate-spin mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.status === "success" ? "default" : "destructive"}>
                          {log.job_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.executed_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{log.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
