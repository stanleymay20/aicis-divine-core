/**
 * Enterprise Governance Hub - Sovereign-Grade Decision Infrastructure
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DecisionLedger } from "@/components/governance/DecisionLedger";
import { ScenarioEngine } from "@/components/governance/ScenarioEngine";
import { SovereignModeControls } from "@/components/governance/SovereignModeControls";
import { HumanInLoopGovernance } from "@/components/governance/HumanInLoopGovernance";
import { OutcomeKPITracker } from "@/components/governance/OutcomeKPITracker";
import { FileText, Beaker, Shield, Users, Target } from "lucide-react";

const EnterpriseGovernance = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-orbitron">Enterprise Governance</h1>
        <p className="text-muted-foreground">
          Sovereign-grade decision infrastructure — accountability, simulation, and human oversight
        </p>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto p-1 gap-1">
          <TabsTrigger value="ledger" className="gap-2">
            <FileText className="h-4 w-4" />Decision Ledger
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="gap-2">
            <Beaker className="h-4 w-4" />Scenario Engine
          </TabsTrigger>
          <TabsTrigger value="sovereign" className="gap-2">
            <Shield className="h-4 w-4" />Sovereign Mode
          </TabsTrigger>
          <TabsTrigger value="governance" className="gap-2">
            <Users className="h-4 w-4" />Human Oversight
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="gap-2">
            <Target className="h-4 w-4" />Outcome KPIs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="mt-6"><DecisionLedger /></TabsContent>
        <TabsContent value="scenarios" className="mt-6"><ScenarioEngine /></TabsContent>
        <TabsContent value="sovereign" className="mt-6"><SovereignModeControls /></TabsContent>
        <TabsContent value="governance" className="mt-6"><HumanInLoopGovernance /></TabsContent>
        <TabsContent value="outcomes" className="mt-6"><OutcomeKPITracker /></TabsContent>
      </Tabs>
    </div>
  );
};

export default EnterpriseGovernance;
