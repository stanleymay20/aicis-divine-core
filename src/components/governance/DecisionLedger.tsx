/**
 * Decision Ledger - Immutable Audit Trail for AI Recommendations
 * Enterprise-grade accountability: every decision traceable with lineage
 */
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Shield, 
  Clock, 
  User, 
  Database,
  ChevronRight,
  Download,
  Link,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface DecisionRecord {
  id: string;
  model_name: string;
  division_key: string;
  input_summary: string;
  output_summary: string;
  confidence: number | null;
  bias_score: number | null;
  ethical_flags: string[] | null;
  explanation: Record<string, unknown> | null;
  reviewer_id: string | null;
  created_at: string | null;
}

interface LedgerEntry {
  id: string;
  entry_type: string;
  hash: string;
  payload: Record<string, unknown>;
  signature: string | null;
  previous_hash: string | null;
  timestamp: string;
  verified: boolean;
  block_number: number;
}

export const DecisionLedger = () => {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<DecisionRecord | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch AI decision logs
        const { data: decisionData } = await supabase
          .from("ai_decision_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        
        if (decisionData) {
          setDecisions(decisionData as DecisionRecord[]);
        }

        // Fetch ledger entries
        const { data: ledgerData } = await supabase
          .from("ledger_entries")
          .select("*")
          .order("block_number", { ascending: false })
          .limit(100);
        
        if (ledgerData) {
          setLedgerEntries(ledgerData as unknown as LedgerEntry[]);
        }
      } catch (error) {
        console.error("Error fetching decision ledger:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("decision-ledger")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_decision_logs" }, 
        (payload) => {
          setDecisions(prev => [payload.new as DecisionRecord, ...prev].slice(0, 50));
        }
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ledger_entries" },
        (payload) => {
          setLedgerEntries(prev => [payload.new as unknown as LedgerEntry, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const exportDecisionLog = (decision: DecisionRecord) => {
    const exportData = {
      decision_id: decision.id,
      timestamp: decision.created_at,
      model: decision.model_name,
      division: decision.division_key,
      input: decision.input_summary,
      output: decision.output_summary,
      confidence: decision.confidence,
      bias_score: decision.bias_score,
      ethical_flags: decision.ethical_flags,
      explanation: decision.explanation,
      reviewed_by: decision.reviewer_id,
      export_timestamp: new Date().toISOString(),
      export_format: "AICIS Decision Audit v1.0"
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aicis-decision-${decision.id.slice(0, 8)}-${format(new Date(), "yyyyMMdd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return "text-muted-foreground";
    if (confidence >= 80) return "text-success";
    if (confidence >= 60) return "text-warning";
    return "text-destructive";
  };

  const getDivisionColor = (division: string) => {
    const colors: Record<string, string> = {
      health: "bg-destructive/20 text-destructive",
      food: "bg-warning/20 text-warning",
      energy: "bg-warning/20 text-warning",
      finance: "bg-success/20 text-success",
      security: "bg-destructive/20 text-destructive",
      governance: "bg-primary/20 text-primary",
      crisis: "bg-destructive/20 text-destructive",
      diplomacy: "bg-accent/20 text-accent-foreground"
    };
    return colors[division] || "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Decision Ledger
          <Badge variant="outline" className="ml-2 font-mono text-xs">
            {decisions.length} Records
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Immutable audit trail — every AI recommendation traceable with data lineage
        </p>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="decisions" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="decisions" className="flex-1">
              <Shield className="h-4 w-4 mr-2" />
              AI Decisions
            </TabsTrigger>
            <TabsTrigger value="ledger" className="flex-1">
              <Link className="h-4 w-4 mr-2" />
              Blockchain Ledger
            </TabsTrigger>
          </TabsList>

          <TabsContent value="decisions" className="mt-4">
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {decisions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No decision records found
                  </div>
                ) : (
                  decisions.map((decision) => (
                    <Dialog key={decision.id}>
                      <DialogTrigger asChild>
                        <div 
                          className="p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setSelectedDecision(decision)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getDivisionColor(decision.division_key)}>
                                  {decision.division_key}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {decision.model_name}
                                </Badge>
                                {decision.ethical_flags && decision.ethical_flags.length > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {decision.ethical_flags.length} Flag(s)
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium truncate">
                                {decision.input_summary}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {decision.output_summary}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={cn("text-lg font-bold", getConfidenceColor(decision.confidence))}>
                                {decision.confidence ? `${decision.confidence}%` : "N/A"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {decision.created_at && format(new Date(decision.created_at), "MMM d, HH:mm")}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      </DialogTrigger>

                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Decision Audit Record
                          </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                          {/* Decision Metadata */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Decision ID</p>
                              <p className="font-mono text-xs break-all">{decision.id}</p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Timestamp</p>
                              <p className="text-sm">
                                {decision.created_at && format(new Date(decision.created_at), "PPpp")}
                              </p>
                            </div>
                          </div>

                          <Separator />

                          {/* Model & Division */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">AI Model</p>
                              <Badge variant="outline" className="font-mono">
                                {decision.model_name}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Division</p>
                              <Badge className={getDivisionColor(decision.division_key)}>
                                {decision.division_key}
                              </Badge>
                            </div>
                          </div>

                          <Separator />

                          {/* Input */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <Database className="h-3 w-3" />
                              Input Summary
                            </p>
                            <div className="p-3 bg-muted/30 rounded-lg text-sm">
                              {decision.input_summary}
                            </div>
                          </div>

                          {/* Output */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Output / Recommendation
                            </p>
                            <div className="p-3 bg-muted/30 rounded-lg text-sm">
                              {decision.output_summary}
                            </div>
                          </div>

                          <Separator />

                          {/* Confidence & Bias */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-muted/30 rounded-lg text-center">
                              <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                              <p className={cn("text-2xl font-bold", getConfidenceColor(decision.confidence))}>
                                {decision.confidence ? `${decision.confidence}%` : "—"}
                              </p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg text-center">
                              <p className="text-xs text-muted-foreground mb-1">Bias Score</p>
                              <p className="text-2xl font-bold text-muted-foreground">
                                {decision.bias_score?.toFixed(1) || "—"}
                              </p>
                            </div>
                            <div className="p-3 bg-muted/30 rounded-lg text-center">
                              <p className="text-xs text-muted-foreground mb-1">Reviewed</p>
                              {decision.reviewer_id ? (
                                <CheckCircle2 className="h-6 w-6 mx-auto text-success" />
                              ) : (
                                <XCircle className="h-6 w-6 mx-auto text-muted-foreground" />
                              )}
                            </div>
                          </div>

                          {/* Ethical Flags */}
                          {decision.ethical_flags && decision.ethical_flags.length > 0 && (
                            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                              <p className="text-xs text-destructive font-semibold mb-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Ethical Flags
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {decision.ethical_flags.map((flag, i) => (
                                  <Badge key={i} variant="destructive" className="text-xs">
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Export Button */}
                          <Button 
                            onClick={() => exportDecisionLog(decision)}
                            className="w-full"
                            variant="outline"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export Audit Record (JSON)
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ledger" className="mt-4">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {ledgerEntries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No ledger entries found
                  </div>
                ) : (
                  ledgerEntries.map((entry, index) => (
                    <div 
                      key={entry.id}
                      className="p-3 border rounded-lg font-mono text-xs"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Block #{entry.block_number}
                          </Badge>
                          <Badge className={cn(
                            "text-xs",
                            entry.verified ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                          )}>
                            {entry.verified ? "Verified" : "Pending"}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {entry.entry_type}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground">
                          {format(new Date(entry.timestamp), "MMM d, HH:mm:ss")}
                        </span>
                      </div>
                      <div className="grid gap-1">
                        <div className="flex">
                          <span className="text-muted-foreground w-16">Hash:</span>
                          <span className="truncate">{entry.hash}</span>
                        </div>
                        {entry.previous_hash && entry.previous_hash !== "genesis" && (
                          <div className="flex">
                            <span className="text-muted-foreground w-16">Prev:</span>
                            <span className="truncate">{entry.previous_hash}</span>
                          </div>
                        )}
                      </div>
                      {index < ledgerEntries.length - 1 && (
                        <div className="flex justify-center mt-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
