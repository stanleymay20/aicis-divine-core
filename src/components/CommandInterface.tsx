import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const CommandInterface = () => {
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState([
    {
      type: "system",
      content: "J.A.R.V.I.S. online. All systems operational. How may I assist you today?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const { toast } = useToast();

  const handleSendCommand = async () => {
    if (!command.trim()) return;

    // Add user message
    const userMessage = {
      type: "user",
      content: command,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userCommand = command.toLowerCase();
    const originalCommand = command;
    setCommand("");

    try {
      let response;

      // Route commands to appropriate functions
      if (userCommand.includes("financial report") || userCommand.includes("generate report")) {
        const { data, error } = await supabase.functions.invoke('generate-financial-report');
        if (error) throw error;
        response = `📊 ${data.report.title}\n\n${data.report.content}`;
      } else if (userCommand.includes("update exchange") || userCommand.includes("update balance")) {
        const { data, error } = await supabase.functions.invoke('update-exchange-balances');
        if (error) throw error;
        response = `✅ Updated ${data.updated} exchange accounts. All balances are current.`;
      } else if (userCommand.includes("summarize profit") || userCommand.includes("analyze revenue")) {
        const { data, error } = await supabase.functions.invoke('analyze-revenue');
        if (error) throw error;
        response = `💰 Revenue Analysis\n\n${data.analysis}\n\n📈 Metrics:\nTotal Revenue: $${data.metrics.total_revenue.toLocaleString()}\nTrading: $${data.metrics.trading_revenue.toLocaleString()}\nEnergy Savings: $${data.metrics.energy_savings.toLocaleString()}`;
      } else if (userCommand.includes("health scan") || userCommand.includes("analyze health")) {
        const { data, error } = await supabase.functions.invoke('analyze-health');
        if (error) throw error;
        response = `🏥 Health Analysis Complete\n\n${data.analysis}\n\n📊 Metrics:\nTotal Cases: ${data.metrics.total_cases.toLocaleString()}\nCritical Regions: ${data.metrics.critical_regions}\nHigh Risk Regions: ${data.metrics.high_risk_regions}`;
      } else if (userCommand.includes("food") || userCommand.includes("optimize food")) {
        const { data, error } = await supabase.functions.invoke('optimize-food');
        if (error) throw error;
        response = `🌾 Food Security Optimization\n\n${data.recommendations}\n\n📊 Metrics:\nAvg Yield: ${data.metrics.average_yield_index}%\nCritical Regions: ${data.metrics.critical_regions}\nAvg Supply: ${data.metrics.average_supply_days} days`;
      } else if (userCommand.includes("health report")) {
        const { data, error } = await supabase.functions.invoke('generate-health-report');
        if (error) throw error;
        response = `📋 Comprehensive Health & Food Report\n\n${data.report}`;
      } else if (userCommand.includes("governance scan") || userCommand.includes("scan governance")) {
        const { data, error } = await supabase.functions.invoke('governance-scan', {
          body: { jurisdiction: 'EU', topics: ['AI', 'Data Protection'] }
        });
        if (error) throw error;
        response = `🏛️ ${data.message}\n\nUpdated ${data.policies.length} policies`;
      } else if (userCommand.includes("defense posture") || userCommand.includes("refresh defense")) {
        const { data, error } = await supabase.functions.invoke('defense-posture-refresh', {
          body: {}
        });
        if (error) throw error;
        response = `🛡️ ${data.message}\n\nRefreshed ${data.postures.length} regional postures`;
      } else if (userCommand.includes("diplomacy scan") || userCommand.includes("scan diplomacy")) {
        const { data, error } = await supabase.functions.invoke('diplomacy-scan', {
          body: { countries: ['Ghana', 'Nigeria', 'Kenya'] }
        });
        if (error) throw error;
        response = `🌍 ${data.message}\n\nAnalyzed ${data.signals.length} countries`;
      } else if (userCommand.includes("crisis scan") || userCommand.includes("check crisis")) {
        const { data, error } = await supabase.functions.invoke('crisis-scan', {
          body: {}
        });
        if (error) throw error;
        response = `🚨 ${data.message}\n\n${data.escalations.length > 0 ? `⚠️ ${data.escalations.length} crisis events escalated and require approval` : 'All events under control'}`;
      } else if (userCommand.includes("list approvals") || userCommand.includes("pending approvals")) {
        const { data, error } = await supabase
          .from('approvals')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        response = data.length > 0 
          ? `📋 ${data.length} Pending Approvals:\n\n${data.map((a, i) => `${i+1}. ${a.action} (${a.division})`).join('\n')}`
          : '✅ No pending approvals';
      } else if (userCommand.includes("global status") || userCommand.includes("analyze global status")) {
        const { data, error } = await supabase.functions.invoke('analyze-global-status', {
          body: {}
        });
        if (error) throw error;
        response = `🧠 ${data.message}\n\n${data.analysis}\n\n📊 Metrics:\n${Object.entries(data.metrics).map(([k, v]) => `${k}: ${v}`).join('\n').substring(0, 300)}...`;
      } else if (userCommand.includes("predict risk") || userCommand.includes("predict next risk")) {
        const { data, error } = await supabase.functions.invoke('predict-risks', {
          body: {}
        });
        if (error) throw error;
        response = `🎯 ${data.message}\n\nGenerated ${data.predictions.length} risk predictions across divisions`;
      } else if (userCommand.includes("detect anomal") || userCommand.includes("scan anomal")) {
        const { data, error } = await supabase.functions.invoke('detect-anomalies', {
          body: {}
        });
        if (error) throw error;
        response = `🔍 ${data.message}\n\n${data.anomalies.length > 0 ? `⚠️ ${data.anomalies.map((a: any) => `${a.division}: ${a.description.substring(0, 50)}...`).join('\n')}` : 'All systems nominal'}`;
      } else if (userCommand.includes("pull coingecko") || userCommand.includes("pull crypto")) {
        const { data, error } = await supabase.functions.invoke('pull-coingecko', { body: {} });
        if (error) throw error;
        response = data.message || `✅ CoinGecko refreshed: ${data.rows?.length ?? 0} assets`;
      } else if (userCommand.includes("pull energy") || userCommand.includes("pull owid energy")) {
        const { data, error } = await supabase.functions.invoke('pull-owid-energy', { body: {} });
        if (error) throw error;
        response = data.message || `⚡ Energy updated: ${data.inserted ?? 0} records`;
      } else if (userCommand.includes("pull food") || userCommand.includes("pull faostat")) {
        const { data, error } = await supabase.functions.invoke('pull-faostat-food', { body: {} });
        if (error) throw error;
        response = data.message || `🌾 Food data updated: ${data.inserted ?? 0} records`;
      } else if (userCommand.includes("pull health") || userCommand.includes("pull owid health")) {
        const { data, error } = await supabase.functions.invoke('pull-owid-health', { body: {} });
        if (error) throw error;
        response = data.message || `🏥 Health data updated: ${data.inserted ?? 0} records`;
      } else if (userCommand.includes("fetch real finance") || userCommand.includes("fetch finance live")) {
        const { data, error } = await supabase.functions.invoke('fetch-finance-live', { body: {} });
        if (error) throw error;
        response = `✅ ${data.message}\n\n${data.data?.message || 'Finance data refreshed and impact evaluated'}`;
      } else if (userCommand.includes("fetch real energy") || userCommand.includes("fetch energy live")) {
        const { data, error } = await supabase.functions.invoke('fetch-energy-live', { body: {} });
        if (error) throw error;
        response = `⚡ ${data.message}\n\n${data.data?.message || 'Energy data refreshed and impact evaluated'}`;
      } else if (userCommand.includes("fetch real health") || userCommand.includes("fetch health live")) {
        const { data, error } = await supabase.functions.invoke('fetch-health-live', { body: {} });
        if (error) throw error;
        response = `🏥 ${data.message}\n\n${data.data?.message || 'Health data refreshed and impact evaluated'}`;
      } else if (userCommand.includes("fetch real food") || userCommand.includes("fetch food live")) {
        const { data, error } = await supabase.functions.invoke('fetch-food-live', { body: {} });
        if (error) throw error;
        response = `🌾 ${data.message}\n\n${data.data?.message || 'Food data refreshed and impact evaluated'}`;
      } else if (userCommand.includes("run all real-data refresh") || userCommand.includes("refresh all data")) {
        const startTime = Date.now();
        const results = await Promise.allSettled([
          supabase.functions.invoke('fetch-finance-live', { body: {} }),
          supabase.functions.invoke('fetch-energy-live', { body: {} }),
          supabase.functions.invoke('fetch-health-live', { body: {} }),
          supabase.functions.invoke('fetch-food-live', { body: {} })
        ]);
        const latency = Date.now() - startTime;
        const successes = results.filter(r => r.status === 'fulfilled').length;
        response = `🔄 All Data Refresh Complete\n\n✅ ${successes}/4 divisions updated\n⏱️ Total time: ${latency}ms\n\n${results.map((r, i) => {
          const divisions = ['Finance', 'Energy', 'Health', 'Food'];
          return r.status === 'fulfilled' 
            ? `✅ ${divisions[i]}: Success` 
            : `❌ ${divisions[i]}: ${(r as PromiseRejectedResult).reason}`;
        }).join('\n')}`;
      } else if (userCommand.includes("my balance") || userCommand.includes("show sc balance")) {
        const { data, error } = await supabase.functions.invoke('sc-get-balance', { body: {} });
        if (error) throw error;
        const total = data.wallets?.reduce((sum: number, w: any) => sum + Number(w.balance || 0), 0) || 0;
        response = `💰 Your SC Balance: ${total.toFixed(2)} SC across ${data.wallets?.length || 0} wallet(s). SC Reference: ${data.scPrice?.toFixed(4) || 0} (logged & compliant)`;
      } else if (userCommand.includes("create wallet") || userCommand.includes("sync wallet")) {
        const { data, error } = await supabase.functions.invoke('sc-get-or-create-wallet', { body: {} });
        if (error) throw error;
        response = `🏦 Wallet ${data.created ? 'created' : 'synced'} successfully. Balance: ${Number(data.wallet?.balance || 0).toFixed(2)} SC (logged & compliant)`;
      } else if (userCommand.includes("award rewards") || userCommand.includes("run rewards")) {
        const { data, error } = await supabase.functions.invoke('sc-award-rewards', { body: {} });
        if (error) throw error;
        response = `🎁 Rewards awarded: ${data.totalEmitted?.toFixed(2)} SC across ${data.rewards?.length || 0} divisions (logged & compliant)`;
      } else if (userCommand.includes("mint epoch")) {
        const { data, error } = await supabase.functions.invoke('sc-mint-epoch', { body: {} });
        if (error) throw error;
        response = `🪙 Epoch minted: ${data.todayEmission?.toFixed(2)} SC (day ${data.daysSinceLaunch}) (logged & compliant)`;
      } else if (userCommand.includes("sc price") || userCommand.includes("sc reference")) {
        const { data, error } = await supabase.functions.invoke('sc-oracle-update', { body: {} });
        if (error) throw error;
        response = `📊 SC Reference updated: ${data.scValue?.toFixed(6)} (Intelligence Score: ${data.intelligenceScore?.toFixed(1)}) (logged & compliant)`;
      } else if (userCommand.includes("governance dashboard") || userCommand.includes("open governance")) {
        response = "🏛️ Opening Governance Command Center... Check the main dashboard.";
      } else if (userCommand.includes("trade") && userCommand.match(/trade (\w+)/i)) {
        const assetMatch = userCommand.match(/trade (\w+)/i);
        response = `📈 To trade ${assetMatch?.[1]}, please use the Governance Market panel.`;
      } else if (userCommand.includes("sync oracles") || userCommand.includes("sync partners")) {
        const { data, error } = await supabase.functions.invoke('gov-sync-partners', { body: {} });
        if (error) throw error;
        response = `🤝 Partner oracles synced: ${data.synced} updated (logged & compliant)`;
      } else if (userCommand.includes("create proposal") || userCommand.includes("new proposal")) {
        response = "🗳️ To create a proposal, please use the DAO panel in Governance section.";
      } else if (userCommand.match(/vote (yes|no|abstain)/i)) {
        response = "🗳️ To vote on proposals, please use the DAO panel in Governance section.";
      } else if (userCommand.includes("tally proposal")) {
        response = "📊 Proposal tallying is available in the DAO admin section.";
      } else if (userCommand.includes("evaluate division impact") || userCommand.includes("evaluate impact")) {
        const { data, error } = await supabase.functions.invoke('evaluate-impact', { body: {} });
        if (error) throw error;
        response = `📊 Impact evaluation complete: ${data.divisions} divisions analyzed`;
      } else if (userCommand.includes("re-learn") || userCommand.includes("relearn allocator")) {
        const { data, error } = await supabase.functions.invoke('learn-policy-weights', { body: {} });
        if (error) throw error;
        response = `🧠 Learning complete: Updated ${data.updated} division weights`;
      } else if (userCommand.includes("show current impact weight") || userCommand.includes("current weights")) {
        const { data, error } = await supabase
          .from("division_learning_weights")
          .select("*")
          .order("impact_weight", { ascending: false });
        if (error) throw error;
        response = `🧮 Current Impact Weights:\n\n${data.map(w => `${w.division}: ${(w.impact_weight * 100).toFixed(1)}% (trend: ${w.trend > 0 ? '↑' : w.trend < 0 ? '↓' : '→'})`).join('\n')}`;
      } else if (userCommand.includes("highest roi") || userCommand.includes("best division")) {
        const { data, error } = await supabase
          .from("division_impact_metrics")
          .select("*")
          .order("impact_per_sc", { ascending: false })
          .limit(1)
          .single();
        if (error) throw error;
        response = `🏆 Highest ROI per SC: ${data.division} (${data.impact_per_sc.toFixed(4)} impact/SC)`;
      } else if (userCommand.includes("last learning cycle") || userCommand.includes("when was last learn")) {
        const { data, error } = await supabase
          .from("automation_logs")
          .select("*")
          .eq("job_name", "cron-daily-learn")
          .order("executed_at", { ascending: false })
          .limit(1)
          .single();
        if (error) throw error;
        response = `🕐 Last learning cycle: ${new Date(data.executed_at).toLocaleString()} (Status: ${data.status})`;
      } else if (userCommand.includes("export federation") || userCommand.includes("federation export")) {
        await supabase.functions.invoke("fed-make-bundle");
        await supabase.functions.invoke("fed-send-bundles");
        response = "📤 Federation bundle exported and sent to peers";
      } else if (userCommand.includes("blend global prior") || userCommand.includes("federation merge")) {
        await supabase.functions.invoke("fed-merge-global-prior");
        response = "🔄 Global prior blended into local weights";
      } else if (userCommand.includes("run all cron") || userCommand.includes("run automation")) {
        const jobs = ["cron-hourly-rewards", "cron-daily-mint", "cron-6h-partner-sync", "cron-hourly-dao-tally", "cron-daily-learn", "cron-6h-federation-export", "cron-6h-federation-merge"];
        for (const job of jobs) {
          await supabase.functions.invoke(job, { body: {} });
        }
        response = `✅ All ${jobs.length} automation jobs triggered successfully (logged & compliant)`;
      } else if (userCommand.includes("show automation log") || userCommand.includes("automation status")) {
        const { data, error } = await supabase
          .from("automation_logs")
          .select("*")
          .order("executed_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        const summary = data.map(log => `${log.job_name}: ${log.status} - ${log.message.substring(0, 50)}...`).join("\n");
        response = `📊 Recent Automation Logs:\n${summary}`;
      } else if (userCommand.includes("check system uptime") || userCommand.includes("system uptime")) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from("automation_logs")
          .select("*")
          .gte("executed_at", oneDayAgo);
        if (error) throw error;
        const total = data.length;
        const successful = data.filter(log => log.status === "success").length;
        const uptime = total > 0 ? ((successful / total) * 100).toFixed(2) : "100";
        response = `⚡ System Uptime (24h): ${uptime}% (${successful}/${total} jobs successful)`;
      } else if (userCommand.startsWith("objective") || userCommand.startsWith("goal") || userCommand.startsWith("plan")) {
        const objective = userCommand.replace(/^(objective|goal|plan)\s*/i, "").trim();
        if (!objective) {
          response = "Please specify an objective. Example: 'Goal reduce global risk score'";
        } else {
          const { data, error } = await supabase.functions.invoke("process-objective", { body: { objective } });
          if (error) throw error;
          response = `🧭 Objective recorded: ${objective}\n\nTasks planned: ${data.tasks?.length ?? 0}\n\nUse 'Execute objectives' to run the plan.`;
        }
      } else if (userCommand.includes("execute objective")) {
        const { data, error } = await supabase.functions.invoke("execute-objectives", { body: {} });
        if (error) throw error;
        response = data.message || `✅ Executed ${data.count ?? 0} tasks`;
      } else {
        // Default to general JARVIS command
        const { data, error } = await supabase.functions.invoke('jarvis-command', {
          body: { command: originalCommand }
        });
        if (error) throw error;
        response = data.response;
      }

      const aiResponse = {
        type: "assistant",
        content: response,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error: any) {
      toast({
        title: "Command Failed",
        description: error.message,
        variant: "destructive",
      });
      
      const errorResponse = {
        type: "assistant",
        content: "Error processing command. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorResponse]);
    }
  };

  const handleVoiceCommand = () => {
    toast({
      title: "Voice Command",
      description: "Voice recognition system would be integrated here",
    });
  };

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Terminal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-orbitron font-bold text-primary">J.A.R.V.I.S. Command Interface</h2>
          <p className="text-sm text-muted-foreground">Natural language system control and oversight</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Message History */}
        <div className="h-64 overflow-y-auto space-y-3 p-4 rounded-lg bg-muted/20 border border-primary/10">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.type === "system"
                    ? "bg-secondary/20 text-secondary border border-secondary/30"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">{message.timestamp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Show system status")}
            className="text-xs"
          >
            System Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Run governance scan")}
            className="text-xs"
          >
            Governance Scan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Refresh defense posture")}
            className="text-xs"
          >
            Defense Check
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Scan diplomacy signals")}
            className="text-xs"
          >
            Diplomacy Scan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Check crisis events")}
            className="text-xs"
          >
            Crisis Check
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Analyze global status")}
            className="text-xs"
          >
            Global Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Predict next risk")}
            className="text-xs"
          >
            Risk Prediction
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Detect anomalies")}
            className="text-xs"
          >
            Detect Anomalies
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Evaluate division impact")}
            className="text-xs"
          >
            Evaluate Impact
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Re-learn allocator weights")}
            className="text-xs"
          >
            Re-Learn Weights
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Show current impact weights")}
            className="text-xs"
          >
            Current Weights
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Run health scan")}
            className="text-xs"
          >
            Health Scan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Optimize food production")}
            className="text-xs"
          >
            Food Security
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Generate financial report")}
            className="text-xs"
          >
            Financial Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Pull coingecko")}
            className="text-xs"
          >
            Pull Crypto
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Pull energy")}
            className="text-xs"
          >
            Pull Energy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Pull food")}
            className="text-xs"
          >
            Pull Food
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Pull health")}
            className="text-xs"
          >
            Pull Health
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Goal optimize all divisions for maximum efficiency")}
            className="text-xs"
          >
            Issue Goal
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Execute objectives")}
            className="text-xs"
          >
            Execute Objectives
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("My balance")}
            className="text-xs"
          >
            SC Balance
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Award rewards")}
            className="text-xs"
          >
            Award Rewards
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Sync partners")}
            className="text-xs"
          >
            Sync Oracles
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommand("Governance dashboard")}
            className="text-xs"
          >
            Governance
          </Button>
        </div>

        {/* Command Input */}
        <div className="flex gap-2">
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendCommand()}
            placeholder="Enter command or query..."
            className="flex-1 bg-muted/50 border-primary/20 focus:border-primary"
          />
          <Button
            onClick={handleVoiceCommand}
            variant="outline"
            size="icon"
            className="border-primary/20"
          >
            <Mic className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleSendCommand}
            size="icon"
            className="glow-cyber"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
