import { AICISLayout } from "@/components/aicis/AICISLayout";
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
        <MeasuredEvidenceTodayPanel />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DailyMeasuredQueue />
          <div className="space-y-4">
            <EvidenceMomentumPanel />
            <OperatorClosureScoreboard />
            <ReviewerClosureScoreboard />
          </div>
        </div>
      </div>
    </AICISLayout>
  );
}
