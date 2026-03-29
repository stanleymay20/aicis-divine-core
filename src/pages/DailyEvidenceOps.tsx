import { AICISPageLayout } from "@/components/aicis/AICISPageLayout";
import DailyMeasuredQueue from "@/components/daily-evidence-ops/DailyMeasuredQueue";
import MeasuredEvidenceTodayPanel from "@/components/daily-evidence-ops/MeasuredEvidenceTodayPanel";
import OperatorClosureScoreboard from "@/components/daily-evidence-ops/OperatorClosureScoreboard";
import ReviewerClosureScoreboard from "@/components/daily-evidence-ops/ReviewerClosureScoreboard";
import EvidenceMomentumPanel from "@/components/daily-evidence-ops/EvidenceMomentumPanel";

export default function DailyEvidenceOps() {
  return (
    <AICISPageLayout title="Daily Evidence Ops" subtitle="Operator console for daily measured evidence production">
      <div className="space-y-4">
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
    </AICISPageLayout>
  );
}
