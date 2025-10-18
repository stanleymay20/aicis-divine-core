import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Building2, Vote, BarChart3 } from "lucide-react";
import { GovernanceMarketPanel } from "./GovernanceMarketPanel";
import DaoPanel from "./DaoPanel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const UnifiedGovernancePanel = () => {
  const [activeTab, setActiveTab] = useState("market");

  const { data: userWallet } = useQuery({
    queryKey: ["user-wallet"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sc-get-balance");
      if (error) throw error;
      return data;
    },
  });

  const { data: daoData } = useQuery({
    queryKey: ["dao-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("dao-get-dashboard");
      if (error) throw error;
      return data;
    },
  });

  const totalBalance = userWallet?.wallets?.reduce(
    (sum: number, w: any) => sum + Number(w.balance || 0),
    0
  ) || 0;

  return (
    <div className="space-y-6">
      {/* Governance Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 backdrop-blur-sm border-primary/20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-orbitron font-bold text-primary mb-2">
              Governance Command Center
            </h2>
            <p className="text-sm text-muted-foreground">
              Market operations, DAO governance, and partner coordination
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Your SC Balance</p>
              <p className="text-2xl font-bold text-primary">{totalBalance.toFixed(2)} SC</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                {daoData?.activeProposals?.length || 0} Active Proposals
              </Badge>
              <Badge variant="outline">
                {daoData?.userVotes?.length || 0} Votes Cast
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Governance Tabs */}
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="market">
              <Building2 className="w-4 h-4 mr-2" />
              Market
            </TabsTrigger>
            <TabsTrigger value="dao">
              <Vote className="w-4 h-4 mr-2" />
              DAO
            </TabsTrigger>
            <TabsTrigger value="partners">
              <Shield className="w-4 h-4 mr-2" />
              Partners
            </TabsTrigger>
            <TabsTrigger value="metrics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="market">
            <GovernanceMarketPanel />
          </TabsContent>

          <TabsContent value="dao">
            <DaoPanel />
          </TabsContent>

          <TabsContent value="partners" className="space-y-4">
            <div className="grid gap-4">
              <p className="text-muted-foreground">
                Partner oracle management integrated in Market tab
              </p>
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground">Active Proposals</p>
                <p className="text-3xl font-bold text-primary">
                  {daoData?.activeProposals?.length || 0}
                </p>
              </Card>
              <Card className="p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground">Your Votes</p>
                <p className="text-3xl font-bold text-primary">
                  {daoData?.userVotes?.length || 0}
                </p>
              </Card>
              <Card className="p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground">SC Balance</p>
                <p className="text-3xl font-bold text-primary">
                  {totalBalance.toFixed(0)}
                </p>
              </Card>
              <Card className="p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground">Governance Index</p>
                <p className="text-3xl font-bold text-primary">
                  {(Math.random() * 0.3 + 0.7).toFixed(3)}
                </p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
