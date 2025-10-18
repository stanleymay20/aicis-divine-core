import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function DaoPanel() {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.functions.invoke("dao-get-dashboard");
    if (data?.ok) setProposals(data.proposals || []);
  };

  useEffect(() => { load(); }, []);

  const vote = async (proposalId: string, choice: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dao-vote", {
        body: { proposal_id: proposalId, choice }
      });
      if (error) throw error;
      toast({ title: "Vote recorded", description: `${choice.toUpperCase()} (weight: ${data.weight})` });
      load();
    } catch (e: any) {
      toast({ title: "Vote failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-2xl bg-card/50 backdrop-blur">
      <h2 className="text-lg font-semibold mb-3">DAO Governance</h2>
      
      <Tabs defaultValue="proposals">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="create">New Proposal</TabsTrigger>
        </TabsList>
        
        <TabsContent value="proposals" className="space-y-2 max-h-96 overflow-auto">
          {proposals.map(p => (
            <div key={p.id} className="p-3 border rounded space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">{p.title}</div>
                  <Badge variant="outline" className="mt-1">{p.status}</Badge>
                </div>
              </div>
              {p.status === "active" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => vote(p.id, "yes")} disabled={loading}>Yes</Button>
                  <Button size="sm" variant="secondary" onClick={() => vote(p.id, "no")} disabled={loading}>No</Button>
                  <Button size="sm" variant="outline" onClick={() => vote(p.id, "abstain")} disabled={loading}>Abstain</Button>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Ends: {new Date(p.voting_ends).toLocaleString()}
              </div>
            </div>
          ))}
        </TabsContent>
        
        <TabsContent value="create">
          <div className="text-sm text-muted-foreground p-4 text-center">
            Use J.A.R.V.I.S. command: "create proposal [title]" to submit proposals
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
