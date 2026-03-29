import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, ListChecks, BarChart3, Shield, FileText } from "lucide-react";
import OutcomeBacklogPanel from "@/components/decision-engine/OutcomeBacklogPanel";
import MeasuredThresholdPanel from "@/components/decision-engine/MeasuredThresholdPanel";
import AuditDensityPanel from "@/components/decision-engine/AuditDensityPanel";
import GovernanceCompletenessPanel from "@/components/decision-engine/GovernanceCompletenessPanel";
import PilotTruthReport from "@/components/decision-engine/PilotTruthReport";
import FirstEvidenceActivationPanel from "@/components/evidence-activation/FirstEvidenceActivationPanel";
import MeasuredEvidenceProgressMini from "@/components/evidence-activation/MeasuredEvidenceProgressMini";

export default function MeasuredAcceleration() {
  return (
    <AICISLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Measured Evidence Acceleration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Accelerate real outcomes, eliminate proxy dominance, prove system value
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FirstEvidenceActivationPanel />
          <MeasuredEvidenceProgressMini />
        </div>

        <MeasuredThresholdPanel />

        <Tabs defaultValue="backlog" className="w-full">
          <TabsList className="bg-muted/50 p-0.5 h-auto flex-wrap">
            <TabsTrigger value="backlog" className="text-xs gap-1.5 data-[state=active]:bg-card">
              <ListChecks className="h-3.5 w-3.5" /> Outcome Backlog
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs gap-1.5 data-[state=active]:bg-card">
              <BarChart3 className="h-3.5 w-3.5" /> Audit Density
            </TabsTrigger>
            <TabsTrigger value="governance" className="text-xs gap-1.5 data-[state=active]:bg-card">
              <Shield className="h-3.5 w-3.5" /> Governance Score
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs gap-1.5 data-[state=active]:bg-card">
              <FileText className="h-3.5 w-3.5" /> Pilot Truth Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backlog" className="mt-4">
            <OutcomeBacklogPanel />
          </TabsContent>
          <TabsContent value="audit" className="mt-4">
            <AuditDensityPanel />
          </TabsContent>
          <TabsContent value="governance" className="mt-4">
            <GovernanceCompletenessPanel />
          </TabsContent>
          <TabsContent value="report" className="mt-4">
            <PilotTruthReport />
          </TabsContent>
        </Tabs>
      </div>
    </AICISLayout>
  );
}