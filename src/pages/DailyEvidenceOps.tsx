import { AICISLayout } from "@/components/aicis/AICISLayout";
import InferenceControl from "@/components/daily-evidence-ops/InferenceControl";
import DailyThroughputPanel from "@/components/daily-evidence-ops/DailyThroughputPanel";
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
      <div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-[1400px] mx-auto animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold">Daily Evidence Ops</h1>
          <p className="text-sm text-muted-foreground">Operator console for daily measured evidence production</p>
        </div>

        {/* Supply + Throughput */}
        <InferenceControl />
        <DailyThroughputPanel />
        <MeasuredEvidenceTodayPanel />

        {/* Main operating area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Inbox + Gap Queue */}
          <div className="space-y-4">
            <NewDecisionsInbox />
            <DailyMeasuredQueue />
          </div>
          {/* Right: Rapid Outcome + Scoreboards + Momentum */}
          <div className="space-y-4">
            <RapidOutcomeMode />
            <EvidenceMomentumPanel />
            <OperatorClosureScoreboard />
            <ReviewerClosureScoreboard />
          </div>
        </div>
      </div>
    </AICISLayout>
  );
}
