import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Globe, RefreshCw } from "lucide-react";

export const DiplomacyPanel = () => {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);

  const { data: signals, refetch } = useQuery({
    queryKey: ['diplo-signals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diplo_signals')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('diplomacy-scan', {
        body: { countries: ['Ghana', 'Nigeria', 'Kenya', 'South Africa'] }
      });

      if (error) throw error;

      toast({
        title: "Diplomacy Scan Complete",
        description: data.message,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const getSentimentBadge = (sentiment: number) => {
    if (sentiment > 0.3) return <Badge variant="default">Positive</Badge>;
    if (sentiment < -0.3) return <Badge variant="destructive">Negative</Badge>;
    return <Badge variant="secondary">Neutral</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Diplomatic Signals</CardTitle>
          </div>
          <Button 
            onClick={handleScan} 
            disabled={isScanning}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            Scan
          </Button>
        </div>
        <CardDescription>
          Geopolitical sentiment and risk analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {signals && signals.length > 0 ? (
            signals.map((signal) => (
              <div key={signal.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{signal.country}</h4>
                  {getSentimentBadge(signal.sentiment)}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Sentiment</span>
                      <span className="font-medium">{signal.sentiment.toFixed(2)}</span>
                    </div>
                    <Progress 
                      value={(signal.sentiment + 1) * 50} 
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Risk Index</span>
                      <span className="font-medium">{signal.risk_index.toFixed(0)}%</span>
                    </div>
                    <Progress 
                      value={Number(signal.risk_index)} 
                      className="h-2"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Updated: {new Date(signal.updated_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8 col-span-2">
              No diplomacy data available. Click "Scan" to begin.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};