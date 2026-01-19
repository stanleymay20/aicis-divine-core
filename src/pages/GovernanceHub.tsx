import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Vote, Users, Scale, FileText, ArrowLeft, Plus,
  ThumbsUp, ThumbsDown, Minus, Clock, CheckCircle,
  XCircle, Building2, Shield, TrendingUp
} from "lucide-react";

const GovernanceHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newProposalTitle, setNewProposalTitle] = useState("");
  const [newProposalDescription, setNewProposalDescription] = useState("");
  const [selectedSpace, setSelectedSpace] = useState<string>("");

  // Fetch DAO spaces
  const { data: spaces } = useQuery({
    queryKey: ["dao-spaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dao_spaces")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch proposals
  const { data: proposals } = useQuery({
    queryKey: ["dao-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dao_proposals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's votes
  const { data: userVotes } = useQuery({
    queryKey: ["user-votes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("dao_votes")
        .select("*")
        .eq("voter_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch governance global data
  const { data: governanceData } = useQuery({
    queryKey: ["governance-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_global")
        .select("*")
        .order("value", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Create proposal mutation
  const createProposal = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("dao-propose", {
        body: {
          space_id: selectedSpace,
          title: newProposalTitle,
          description: newProposalDescription,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Proposal Created",
        description: "Your proposal has been submitted for voting",
      });
      setNewProposalTitle("");
      setNewProposalDescription("");
      queryClient.invalidateQueries({ queryKey: ["dao-proposals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Proposal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Vote mutation
  const castVote = useMutation({
    mutationFn: async ({ proposalId, voteType }: { proposalId: string; voteType: string }) => {
      const { data, error } = await supabase.functions.invoke("dao-vote", {
        body: { proposal_id: proposalId, vote_type: voteType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Vote Cast",
        description: "Your vote has been recorded",
      });
      queryClient.invalidateQueries({ queryKey: ["dao-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["user-votes"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Vote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getVotePercentage = (proposal: any) => {
    const total = (proposal.votes_for || 0) + (proposal.votes_against || 0) + (proposal.votes_abstain || 0);
    if (total === 0) return { for: 0, against: 0, abstain: 0 };
    return {
      for: ((proposal.votes_for || 0) / total) * 100,
      against: ((proposal.votes_against || 0) / total) * 100,
      abstain: ((proposal.votes_abstain || 0) / total) * 100,
    };
  };

  const hasVoted = (proposalId: string) => {
    return userVotes?.some((v: any) => v.proposal_id === proposalId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Scale className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-orbitron font-bold">Governance Hub</h1>
                <p className="text-xs text-muted-foreground">DAO & Policy Management</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="proposals">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="proposals">
              <Vote className="w-4 h-4 mr-2" />
              Proposals
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="w-4 h-4 mr-2" />
              Create
            </TabsTrigger>
            <TabsTrigger value="indicators">
              <TrendingUp className="w-4 h-4 mr-2" />
              Indicators
            </TabsTrigger>
            <TabsTrigger value="spaces">
              <Building2 className="w-4 h-4 mr-2" />
              Spaces
            </TabsTrigger>
          </TabsList>

          {/* Proposals Tab */}
          <TabsContent value="proposals" className="space-y-4">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {proposals?.length === 0 && (
                  <Card className="p-8 text-center">
                    <Vote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No proposals yet</p>
                    <Button className="mt-4" onClick={() => navigate("/governance?tab=create")}>
                      Create First Proposal
                    </Button>
                  </Card>
                )}
                {proposals?.map((proposal: any) => {
                  const percentages = getVotePercentage(proposal);
                  const voted = hasVoted(proposal.id);
                  const isActive = proposal.status === "active";

                  return (
                    <Card key={proposal.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{proposal.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {proposal.description?.slice(0, 150)}...
                            </CardDescription>
                          </div>
                          <Badge variant={isActive ? "default" : "secondary"}>
                            {proposal.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Vote Progress */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-green-500">For: {percentages.for.toFixed(1)}%</span>
                            <span className="text-red-500">Against: {percentages.against.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                            <div 
                              className="bg-green-500 h-full" 
                              style={{ width: `${percentages.for}%` }} 
                            />
                            <div 
                              className="bg-red-500 h-full" 
                              style={{ width: `${percentages.against}%` }} 
                            />
                            <div 
                              className="bg-muted-foreground/30 h-full" 
                              style={{ width: `${percentages.abstain}%` }} 
                            />
                          </div>
                        </div>

                        {/* Vote Buttons */}
                        {isActive && !voted && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-green-500 border-green-500/30 hover:bg-green-500/10"
                              onClick={() => castVote.mutate({ proposalId: proposal.id, voteType: "for" })}
                            >
                              <ThumbsUp className="w-4 h-4 mr-2" />
                              For
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => castVote.mutate({ proposalId: proposal.id, voteType: "against" })}
                            >
                              <ThumbsDown className="w-4 h-4 mr-2" />
                              Against
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => castVote.mutate({ proposalId: proposal.id, voteType: "abstain" })}
                            >
                              <Minus className="w-4 h-4 mr-2" />
                              Abstain
                            </Button>
                          </div>
                        )}

                        {voted && (
                          <Badge variant="outline" className="w-full justify-center py-2">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            You have voted on this proposal
                          </Badge>
                        )}

                        {/* Timeline */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>Ends: {new Date(proposal.voting_ends_at).toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Create Proposal Tab */}
          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create New Proposal</CardTitle>
                <CardDescription>Submit a proposal for community voting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Space</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {spaces?.map((space: any) => (
                      <Button
                        key={space.id}
                        variant={selectedSpace === space.id ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => setSelectedSpace(space.id)}
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        {space.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Proposal Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter proposal title..."
                    value={newProposalTitle}
                    onChange={(e) => setNewProposalTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your proposal in detail..."
                    value={newProposalDescription}
                    onChange={(e) => setNewProposalDescription(e.target.value)}
                    rows={6}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => createProposal.mutate()}
                  disabled={!selectedSpace || !newProposalTitle || createProposal.isPending}
                >
                  <Vote className="w-4 h-4 mr-2" />
                  Submit Proposal
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Global Governance Indicators Tab */}
          <TabsContent value="indicators" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Global Governance Indicators</CardTitle>
                <CardDescription>World Bank Governance Indicators (WGI)</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {governanceData?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{item.country}</p>
                          <p className="text-sm text-muted-foreground">{item.indicator_name}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            item.value > 1 ? 'text-green-500' : 
                            item.value > 0 ? 'text-yellow-500' : 
                            'text-red-500'
                          }`}>
                            {item.value?.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.year}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Spaces Tab */}
          <TabsContent value="spaces" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {spaces?.map((space: any) => (
                <Card key={space.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      {space.name}
                    </CardTitle>
                    <CardDescription>{space.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <p className="text-muted-foreground">Voting Delay</p>
                        <p className="font-bold">{space.voting_delay_hours}h</p>
                      </div>
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <p className="text-muted-foreground">Voting Period</p>
                        <p className="font-bold">{space.voting_period_hours}h</p>
                      </div>
                      <div className="text-center p-2 bg-muted/30 rounded">
                        <p className="text-muted-foreground">Quorum</p>
                        <p className="font-bold">{space.quorum_percentage}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default GovernanceHub;
