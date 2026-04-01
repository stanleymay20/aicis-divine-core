import { AICISLayout } from "@/components/aicis/AICISLayout";
import InferenceControl from "@/components/daily-evidence-ops/InferenceControl";
import DailyThroughputPanel from "@/components/daily-evidence-ops/DailyThroughputPanel";
import CompletionVelocityPanel from "@/components/daily-evidence-ops/CompletionVelocityPanel";
import ExecutionStageBoard from "@/components/daily-evidence-ops/ExecutionStageBoard";
import NewDecisionsInbox from "@/components/daily-evidence-ops/NewDecisionsInbox";
import RapidOutcomeMode from "@/components/daily-evidence-ops/RapidOutcomeMode";
import DailyMeasuredQueue from "@/components/daily-evidence-ops/DailyMeasuredQueue";
import MeasuredEvidenceTodayPanel from "@/components/daily-evidence-ops/MeasuredEvidenceTodayPanel";
import OperatorClosureScoreboard from "@/components/daily-evidence-ops/OperatorClosureScoreboard";
import ReviewerClosureScoreboard from "@/components/daily-evidence-ops/ReviewerClosureScoreboard";
import EvidenceMomentumPanel from "@/components/daily-evidence-ops/EvidenceMomentumPanel";

export default function DailyEvidenceOps() {
  return (
    <AICISLayout>
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 max-w-[1400px] mx-auto animate-fade-in">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Daily Evidence Ops</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Operator console for daily measured evidence production</p>
          </div>

          {/* Supply + KPIs */}
          <InferenceControl />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <DailyThroughputPanel />
            <CompletionVelocityPanel />
          </div>
          <MeasuredEvidenceTodayPanel />

          {/* Execution pipeline */}
          <ExecutionStageBoard />

          {/* Operating area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-3 sm:space-y-4">
              <NewDecisionsInbox />
              <DailyMeasuredQueue />
            </div>
            <div className="space-y-3 sm:space-y-4">
              <RapidOutcomeMode />
              <EvidenceMomentumPanel />
              <OperatorClosureScoreboard />
              <ReviewerClosureScoreboard />
            </div>
          </div>
        </div>
      </div>
    </AICISLayout>
  );
}
