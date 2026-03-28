import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Moon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const OvernightChanges = () => {
  const { data: changes } = useQuery({
    queryKey: ["overnight-changes"],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 12);

      const [alertsRes, crisesRes, anomaliesRes] = await Promise.all([
        supabase
          .from("alerts")
          .select("id, title, severity, country, created_at")
          .gte("created_at", yesterday.toISOString())
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("crisis_events")
          .select("id, kind, region, severity, status, created_at")
          .gte("created_at", yesterday.toISOString())
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("anomaly_detections")
          .select("id, anomaly_type, division, severity, detected_at")
          .gte("detected_at", yesterday.toISOString())
          .order("detected_at", { ascending: false })
          .limit(3),
      ]);

      return {
        alerts: alertsRes.data || [],
        crises: crisesRes.data || [],
        anomalies: anomaliesRes.data || [],
      };
    },
    staleTime: 60_000,
  });

  const totalEvents = (changes?.alerts.length || 0) + (changes?.crises.length || 0) + (changes?.anomalies.length || 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Moon className="h-4 w-4" />
          Overnight Activity
          <Badge variant="outline" className="ml-auto text-xs">{totalEvents} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
        {changes?.crises.map(c => (
          <div key={c.id} className="flex items-start gap-2 text-sm p-1.5 rounded hover:bg-muted/50">
            <TrendingDown className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-medium">{c.kind} — {c.region}</p>
              <p className="text-xs text-muted-foreground">
                Severity {c.severity} · {formatDistanceToNow(new Date(c.created_at!), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
        {changes?.alerts.slice(0, 3).map(a => (
          <div key={a.id} className="flex items-start gap-2 text-sm p-1.5 rounded hover:bg-muted/50">
            <Minus className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.severity} · {a.country || "Global"} · {formatDistanceToNow(new Date(a.created_at!), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
        {changes?.anomalies.map(a => (
          <div key={a.id} className="flex items-start gap-2 text-sm p-1.5 rounded hover:bg-muted/50">
            <TrendingUp className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate">Anomaly: {a.anomaly_type}</p>
              <p className="text-xs text-muted-foreground">
                {a.division} · {a.severity}
              </p>
            </div>
          </div>
        ))}
        {totalEvents === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No significant overnight changes</p>
        )}
      </CardContent>
    </Card>
  );
};
