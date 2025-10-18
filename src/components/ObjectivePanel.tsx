import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Target, Play, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

export const ObjectivePanel = () => {
  const { toast } = useToast();
  const [objectives, setObjectives] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("objectives")
        .select("*, objective_tasks(count)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setObjectives(data || []);
    } catch (e: any) {
      console.error("Load objectives error:", e);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const submit = async () => {
    if (!text.trim()) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("process-objective", {
        body: { objective: text }
      });

      if (error) throw error;

      toast({
        title: "Objective Processed",
        description: `${data.tasks?.length ?? 0} tasks planned`,
      });

      setText("");
      load();
    } catch (e: any) {
      toast({
        title: "Error Processing Objective",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    try {
      setExecuting(true);
      const { data, error } = await supabase.functions.invoke("execute-objectives", {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Objectives Executed",
        description: data.message || `${data.count} tasks executed`,
      });

      load();
    } catch (e: any) {
      toast({
        title: "Execution Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "executing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: "outline",
      executing: "default",
      completed: "default",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Strategic Objectives</CardTitle>
          </div>
          <Button
            onClick={execute}
            disabled={executing}
            size="sm"
            variant="outline"
          >
            <Play className={`h-4 w-4 mr-2 ${executing ? 'animate-spin' : ''}`} />
            Execute All
          </Button>
        </div>
        <CardDescription>
          Issue strategic goals and AICIS will plan and execute them
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && submit()}
            placeholder="e.g., Analyze global financial risks and optimize energy usage"
            className="flex-1"
            disabled={loading}
          />
          <Button onClick={submit} disabled={loading || !text.trim()}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Issue"}
          </Button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-auto">
          {objectives.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No strategic objectives yet</p>
              <p className="text-sm">Issue your first objective above</p>
            </div>
          ) : (
            objectives.map((obj) => (
              <div
                key={obj.id}
                className="p-3 border rounded-lg bg-card/50 hover:bg-card/70 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(obj.status)}
                      <span className="font-medium text-sm">{obj.objective_text}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(obj.created_at).toLocaleString()}</span>
                      {obj.ai_plan && (
                        <Badge variant="secondary" className="text-xs">
                          {obj.ai_plan.length} tasks
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        Priority: {obj.priority}
                      </Badge>
                    </div>
                  </div>
                  {getStatusBadge(obj.status)}
                </div>
                {obj.ai_summary && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {obj.ai_summary}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
