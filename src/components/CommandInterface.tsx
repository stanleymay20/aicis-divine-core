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
