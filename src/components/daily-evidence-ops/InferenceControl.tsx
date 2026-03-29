import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";

export default function InferenceControl() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<{ total: number; failed: number } | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("trigger-daily-inference");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setResult({ total: data?.total_recommendations ?? 0, failed: data?.failed_domains ?? 0 });
      queryClient.invalidateQueries({ queryKey: ["daily-measured-queue"] });
      queryClient.invalidateQueries({ queryKey: ["new-decisions-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["daily-throughput"] });
      queryClient.invalidateQueries({ queryKey: ["measured-evidence-today"] });
      toast.success(`Generated ${data?.total_recommendations ?? 0} recommendations`);
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Generate Fresh Decisions</p>
          <p className="text-xs text-muted-foreground">Run inference across all domains to create new recommendations</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result && (
            <Badge variant={result.failed > 0 ? "destructive" : "default"} className="text-xs font-mono">
              {result.total} recs / {7 - result.failed} domains
            </Badge>
          )}
          <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending} className="h-8 text-xs">
            {run.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
            {run.isPending ? "Running…" : "Run Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
