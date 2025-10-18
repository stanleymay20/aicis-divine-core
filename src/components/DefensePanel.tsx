import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, RefreshCw } from "lucide-react";

export const DefensePanel = () => {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: postures, refetch } = useQuery({
    queryKey: ['defense-posture'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('defense_posture')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('defense-posture-refresh', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Defense Posture Refreshed",
        description: data.message,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getThreatColor = (level: number) => {
    if (level >= 7) return "text-destructive";
    if (level >= 4) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <CardTitle>Defensive Security</CardTitle>
          </div>
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Regional threat monitoring and defensive recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {postures && postures.length > 0 ? (
            postures.map((posture) => (
              <div key={posture.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{posture.region}</h4>
                  <Badge variant="outline" className={getThreatColor(posture.threat_level)}>
                    Threat Level: {posture.threat_level}/10
                  </Badge>
                </div>
                <Progress value={posture.threat_level * 10} className="mb-3" />
                {posture.advisories_md && (
                  <div className="text-sm prose prose-sm dark:prose-invert">
                    {posture.advisories_md.substring(0, 200)}...
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Updated: {new Date(posture.updated_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No defense data available. Click "Refresh" to scan.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};