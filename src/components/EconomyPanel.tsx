import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Coins, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function EconomyPanel() {
  const { toast } = useToast();
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [scPrice, setScPrice] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("sc-get-balance", {
        body: {},
      });

      if (error) throw error;

      setWallets(data.wallets || []);
      setTransactions(data.transactions || []);
      setScPrice(data.scPrice || 0);
    } catch (e: any) {
      console.error("Load balance error:", e);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const createWallet = async (division?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sc-get-or-create-wallet",
        { body: { division } }
      );

      if (error) throw error;

      toast({
        title: data.created ? "Wallet created" : "Wallet exists",
        description: `${division || "Personal"} wallet ready`,
      });

      load();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTxBadge = (txType: string) => {
    switch (txType) {
      case "reward":
      case "mint":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Reward</Badge>;
      case "transfer_in":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">In</Badge>;
      case "transfer_out":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Out</Badge>;
      case "burn":
      case "lock":
        return <Badge variant="destructive">Lock</Badge>;
      default:
        return <Badge variant="outline">{txType}</Badge>;
    }
  };

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
  const totalLocked = wallets.reduce((sum, w) => sum + Number(w.locked || 0), 0);
  const totalAvailable = totalBalance - totalLocked;

  return (
    <Card className="p-4 bg-card/50 backdrop-blur border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">ScrollCoin Economy</h2>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            SC: {scPrice.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg border bg-card/30">
          <div className="text-xs text-muted-foreground">Total Balance</div>
          <div className="text-xl font-bold">{totalBalance.toFixed(2)} SC</div>
        </div>
        <div className="p-3 rounded-lg border bg-card/30">
          <div className="text-xs text-muted-foreground">Available</div>
          <div className="text-xl font-bold text-green-400">
            {totalAvailable.toFixed(2)} SC
          </div>
        </div>
        <div className="p-3 rounded-lg border bg-card/30">
          <div className="text-xs text-muted-foreground">Locked</div>
          <div className="text-xl font-bold text-orange-400">
            {totalLocked.toFixed(2)} SC
          </div>
        </div>
      </div>

      {/* Wallets */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">My Wallets</h3>
        {wallets.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No wallets yet
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-auto">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex justify-between items-center p-2 rounded border text-sm"
              >
                <span className="font-medium">
                  {wallet.division || "Personal"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {Number(wallet.balance).toFixed(2)} SC
                  </span>
                  {Number(wallet.locked) > 0 && (
                    <span className="text-xs text-orange-400">
                      ({Number(wallet.locked).toFixed(2)} locked)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No transactions yet
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-auto">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center p-2 rounded border text-sm"
              >
                <div className="flex items-center gap-2">
                  {getTxBadge(tx.tx_type)}
                  <span className="text-xs text-muted-foreground">
                    {tx.memo || tx.tx_type}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {tx.tx_type.includes("in") || tx.tx_type === "reward" || tx.tx_type === "mint" ? (
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-orange-400" />
                  )}
                  <span className="font-medium">
                    {Number(tx.amount).toFixed(2)} SC
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={() => createWallet()}
          disabled={loading}
          size="sm"
          variant="outline"
          className="flex-1"
        >
          Create Wallet
        </Button>
        <Button
          onClick={load}
          size="sm"
          variant="outline"
          className="flex-1"
        >
          Refresh
        </Button>
      </div>
    </Card>
  );
}
