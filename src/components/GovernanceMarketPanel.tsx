import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Store, TrendingUp, Users, BarChart3, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const GovernanceMarketPanel = () => {
  const { toast } = useToast();
  const [tradeAmount, setTradeAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string>("");

  const { data: assetsData, refetch: refetchAssets } = useQuery({
    queryKey: ["governance-assets"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gov-get-assets");
      if (error) throw error;
      return data;
    },
  });

  const { data: tradesData, refetch: refetchTrades } = useQuery({
    queryKey: ["governance-trades"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gov-get-assets");
      if (error) throw error;
      
      // Get trades from the governance_trades table via RPC
      const { data: trades } = await supabase
        .from("governance_trades" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      return trades || [];
    },
  });

  const handleTrade = async () => {
    if (!selectedAsset || !tradeAmount) {
      toast({
        title: "Missing Information",
        description: "Please select an asset and enter amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("gov-initiate-trade", {
        body: { asset_symbol: selectedAsset, asset_amount: parseFloat(tradeAmount) },
      });
      if (error) throw error;

      toast({
        title: "Trade Initiated",
        description: `${tradeAmount} ${selectedAsset} trade pending execution`,
      });
      
      setTradeAmount("");
      refetchTrades();
    } catch (error: any) {
      toast({
        title: "Trade Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSyncPartners = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("gov-sync-partners");
      if (error) throw error;

      toast({
        title: "Partners Synced",
        description: `Updated ${data.synced} partner oracles`,
      });
      
      refetchAssets();
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <Tabs defaultValue="market" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="market">
            <Store className="w-4 h-4 mr-2" />
            Market
          </TabsTrigger>
          <TabsTrigger value="partners">
            <Users className="w-4 h-4 mr-2" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="trades">
            <TrendingUp className="w-4 h-4 mr-2" />
            My Trades
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="market" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-orbitron font-bold text-primary">Governance Assets</h3>
            <Button variant="outline" size="sm" onClick={() => refetchAssets()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid gap-3">
            {assetsData?.assets?.map((asset: any) => (
              <Card key={asset.id} className="p-4 bg-muted/20">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{asset.asset_symbol}</h4>
                      <Badge variant="outline">{asset.source_system}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{asset.asset_name}</p>
                    <p className="text-xs text-muted-foreground mt-2">{asset.description_md}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setSelectedAsset(asset.asset_symbol)}
                    variant={selectedAsset === asset.asset_symbol ? "default" : "outline"}
                  >
                    Select
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {selectedAsset && (
            <Card className="p-4 bg-primary/10">
              <Label htmlFor="amount">Trade Amount</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="amount"
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder="Amount"
                />
                <Button onClick={handleTrade}>Initiate Trade</Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="partners" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-orbitron font-bold text-primary">Partner Oracles</h3>
            <Button variant="outline" size="sm" onClick={handleSyncPartners}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Partners
            </Button>
          </div>

          <div className="grid gap-3">
            {assetsData?.partners?.map((partner: any) => (
              <Card key={partner.id} className="p-4 bg-muted/20">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold">{partner.partner_name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last checked: {new Date(partner.last_checked).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{partner.trust_score}%</div>
                    <Badge variant={partner.enabled ? "default" : "secondary"}>
                      {partner.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trades" className="space-y-4">
          <h3 className="text-lg font-orbitron font-bold text-primary mb-4">Recent Trades</h3>
          <div className="space-y-3">
            {tradesData?.map((trade: any) => (
              <Card key={trade.id} className="p-4 bg-muted/20">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{trade.asset_symbol}</span>
                      <Badge variant="outline">{trade.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {trade.asset_amount} @ {trade.price} SC/unit = {trade.sc_amount} SC
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(trade.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <h3 className="text-lg font-orbitron font-bold text-primary mb-4">Governance Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-muted/20">
              <p className="text-sm text-muted-foreground">SC Reference</p>
              <p className="text-2xl font-bold text-primary">
                {assetsData?.scPrice?.value?.toFixed(6) || "—"}
              </p>
            </Card>
            <Card className="p-4 bg-muted/20">
              <p className="text-sm text-muted-foreground">Avg Trust Score</p>
              <p className="text-2xl font-bold text-primary">
                {assetsData?.partners?.reduce((sum: number, p: any) => sum + p.trust_score, 0) / 
                 (assetsData?.partners?.length || 1)}%
              </p>
            </Card>
            <Card className="p-4 bg-muted/20">
              <p className="text-sm text-muted-foreground">Active Assets</p>
              <p className="text-2xl font-bold text-primary">{assetsData?.assets?.length || 0}</p>
            </Card>
            <Card className="p-4 bg-muted/20">
              <p className="text-sm text-muted-foreground">Active Partners</p>
              <p className="text-2xl font-bold text-primary">
                {assetsData?.partners?.filter((p: any) => p.enabled)?.length || 0}
              </p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
