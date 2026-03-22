import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, PlayCircle, BarChart3, Beaker, CreditCard } from "lucide-react";
import DailyTaskPanel from "@/components/decision-engine/DailyTaskPanel";
import ExecutionCommandCenter from "@/components/decision-engine/ExecutionCommandCenter";
import OutcomeInputPanel from "@/components/decision-engine/OutcomeInputPanel";
import PilotModePanel from "@/components/decision-engine/PilotModePanel";
import { BillingPanel } from "@/components/BillingPanel";

export default function DecisionOperations() {
  return (
    <AICISLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Decision Operations Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daily activation, execution tracking, outcome capture, and billing
          </p>
        </div>

        {/* Always visible: Daily Tasks */}
        <DailyTaskPanel />

        <Tabs defaultValue="execution" className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="execution" className="text-xs gap-1">
              <PlayCircle className="h-3 w-3" /> Execution
            </TabsTrigger>
            <TabsTrigger value="outcomes" className="text-xs gap-1">
              <BarChart3 className="h-3 w-3" /> Outcomes
            </TabsTrigger>
            <TabsTrigger value="pilot" className="text-xs gap-1">
              <Beaker className="h-3 w-3" /> Pilot Report
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs gap-1">
              <CreditCard className="h-3 w-3" /> Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="execution" className="mt-4">
            <ExecutionCommandCenter />
          </TabsContent>
          <TabsContent value="outcomes" className="mt-4">
            <OutcomeInputPanel />
          </TabsContent>
          <TabsContent value="pilot" className="mt-4">
            <PilotModePanel />
          </TabsContent>
          <TabsContent value="billing" className="mt-4">
            <BillingPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AICISLayout>
  );
}
