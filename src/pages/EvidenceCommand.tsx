import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Shield } from "lucide-react";
import DailyTargetTracker from "@/components/decision-engine/DailyTargetTracker";
import DailyEvidenceScore from "@/components/decision-engine/DailyEvidenceScore";
import MeasuredOutcomeKPI from "@/components/decision-engine/MeasuredOutcomeKPI";
import ExecutionAccountabilityPanel from "@/components/decision-engine/ExecutionAccountabilityPanel";
import ReviewerPerformancePanel from "@/components/decision-engine/ReviewerPerformancePanel";
import DomainEvidenceScorecard from "@/components/decision-engine/DomainEvidenceScorecard";
import OutcomeBacklogBurner from "@/components/decision-engine/OutcomeBacklogBurner";
import MeasuredOutcomeFastPath from "@/components/decision-engine/MeasuredOutcomeFastPath";
import AuditCompletenessChecker from "@/components/decision-engine/AuditCompletenessChecker";
import BillingHealthPanel from "@/components/decision-engine/BillingHealthPanel";
import PilotConversionReport from "@/components/decision-engine/PilotConversionReport";

export default function EvidenceCommand() {
  return (
    <AICISLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Evidence Command
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily enforcement — accountability by person, domain, and closure target
          </p>
        </div>

        {/* Row 1: Daily Targets + Evidence Score + Measured KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DailyTargetTracker />
          <DailyEvidenceScore />
          <MeasuredOutcomeKPI />
        </div>

        {/* Row 2: Execution + Reviewer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExecutionAccountabilityPanel />
          <ReviewerPerformancePanel />
        </div>

        {/* Row 3: Domain Scorecard */}
        <DomainEvidenceScorecard />

        {/* Row 4: Backlog + Fast Path */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OutcomeBacklogBurner />
          <MeasuredOutcomeFastPath />
        </div>

        {/* Row 5: Audit + Billing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AuditCompletenessChecker />
          <BillingHealthPanel />
        </div>

        {/* Row 6: Pilot Report */}
        <PilotConversionReport />
      </div>
    </AICISLayout>
  );
}
