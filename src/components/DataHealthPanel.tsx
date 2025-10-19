import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

interface DataSourceHealth {
  division: string;
  source: string;
  records_ingested: number;
  latency_ms: number | null;
  status: string;
  last_success: string | null;
  created_at: string;
  freshness: 'fresh' | 'stale' | 'critical';
  hoursAgo: number;
}

export const DataHealthPanel = () => {
  const [healthData, setHealthData] = useState<DataSourceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      // Get latest log for each division
      const { data, error } = await supabase
        .from('data_source_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by division and get latest
      const latestByDivision: Record<string, any> = {};
      data?.forEach(log => {
        if (!latestByDivision[log.division] || 
            new Date(log.created_at) > new Date(latestByDivision[log.division].created_at)) {
          latestByDivision[log.division] = log;
        }
      });

      // Calculate freshness
      const now = Date.now();
      const healthRecords = Object.values(latestByDivision).map((log: any) => {
        const hoursAgo = (now - new Date(log.created_at).getTime()) / (1000 * 60 * 60);
        let freshness: 'fresh' | 'stale' | 'critical';
        
        if (hoursAgo < 6) freshness = 'fresh';
        else if (hoursAgo < 12) freshness = 'stale';
        else freshness = 'critical';

        return {
          ...log,
          hoursAgo,
          freshness
        };
      });

      setHealthData(healthRecords);
    } catch (error) {
      console.error("Error fetching health data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data health metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const refreshDivision = async (division: string) => {
    setRefreshing(division);
    try {
      const functionMap: Record<string, string> = {
        finance: 'fetch-finance-live',
        energy: 'fetch-energy-live',
        health: 'fetch-health-live',
        food: 'fetch-food-live',
      };

      const functionName = functionMap[division];
      if (!functionName) throw new Error(`No fetch function for ${division}`);

      const { data, error } = await supabase.functions.invoke(functionName);
      
      if (error) throw error;

      toast({
        title: "Data Refreshed",
        description: `${division.charAt(0).toUpperCase() + division.slice(1)} data updated successfully`,
      });

      await fetchHealthData();
    } catch (error) {
      console.error(`Error refreshing ${division}:`, error);
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRefreshing(null);
    }
  };

  const refreshAll = async () => {
    setRefreshing('all');
    try {
      await Promise.all([
        supabase.functions.invoke('fetch-finance-live'),
        supabase.functions.invoke('fetch-energy-live'),
        supabase.functions.invoke('fetch-health-live'),
        supabase.functions.invoke('fetch-food-live'),
      ]);

      toast({
        title: "All Data Refreshed",
        description: "Successfully updated all division data sources",
      });

      await fetchHealthData();
    } catch (error) {
      console.error("Error refreshing all:", error);
      toast({
        title: "Refresh Failed",
        description: "Some data sources failed to refresh",
        variant: "destructive",
      });
    } finally {
      setRefreshing(null);
    }
  };

  const getFreshnessIcon = (freshness: string) => {
    switch (freshness) {
      case 'fresh': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'stale': return <Activity className="w-4 h-4 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getFreshnessColor = (freshness: string) => {
    switch (freshness) {
      case 'fresh': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'stale': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return '';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading data health metrics...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Real-Time Data Health Monitor</h3>
          <p className="text-sm text-muted-foreground">Live API ingestion status and freshness</p>
        </div>
        <Button 
          onClick={refreshAll}
          disabled={refreshing !== null}
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing === 'all' ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      <div className="grid gap-4">
        {healthData.map((health) => (
          <div
            key={health.division}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center gap-4">
              {getFreshnessIcon(health.freshness)}
              <div>
                <div className="font-medium capitalize">{health.division}</div>
                <div className="text-sm text-muted-foreground">
                  Source: {health.source} • {health.records_ingested} records
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant="outline" className={getFreshnessColor(health.freshness)}>
                {health.hoursAgo < 1 
                  ? `${Math.floor(health.hoursAgo * 60)}m ago`
                  : `${Math.floor(health.hoursAgo)}h ago`
                }
              </Badge>

              {health.latency_ms && (
                <Badge variant="outline">
                  {Math.round(health.latency_ms)}ms
                </Badge>
              )}

              <Badge
                variant={health.status === 'success' ? 'default' : 'destructive'}
              >
                {health.status}
              </Badge>

              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshDivision(health.division)}
                disabled={refreshing !== null}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing === health.division ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        ))}

        {healthData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No data sources found. Run initial data fetch to populate.
          </div>
        )}
      </div>
    </Card>
  );
};
