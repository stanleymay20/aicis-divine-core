import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Badge } from "@/components/ui/badge";
import { Shield, Brain } from "lucide-react";
import TrustScorePanel from "@/components/decision-engine/TrustScorePanel";
import BaselineComparison from "@/components/decision-engine/BaselineComparison";
import ModelSafetyPanel from "@/components/decision-engine/ModelSafetyPanel";
import SilentFailurePanel from "@/components/decision-engine/SilentFailurePanel";
import ExecutionPipelinePanel from "@/components/decision-engine/ExecutionPipelinePanel";
import MeasuredEvidenceProgressPanel from "@/components/decision-engine/MeasuredEvidenceProgressPanel";
import ReviewerAccountabilityPanel from "@/components/decision-engine/ReviewerAccountabilityPanel";
import ActionLeaderboard from "@/components/decision-engine/ActionLeaderboard";
import DecisionKPIPanel from "@/components/decision-engine/DecisionKPIPanel";
import ModelPromotionLog from "@/components/decision-engine/ModelPromotionLog";
import LearningCycleHealth from "@/components/decision-engine/LearningCycleHealth";
import InferenceActivityPanel from "@/components/decision-engine/InferenceActivityPanel";
import PromotionReadinessGate from "@/components/decision-engine/PromotionReadinessGate";
import EvidenceBacklogQueue from "@/components/decision-engine/EvidenceBacklogQueue";

export default function OperationalTruth() {
  return (
    <AICISLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Operational Truth Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Single-pane system health view — every claim backed by live data
          </p>
        </div>

        {/* Row 1: Model Safety + Trust */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModelSafetyPanel />
          <TrustScorePanel />
        </div>

        {/* Row 2: Promotion Gate + Silent Failures */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PromotionReadinessGate />
          <SilentFailurePanel />
        </div>

        {/* Row 3: Inference Activity */}
        <InferenceActivityPanel />

        {/* Row 4: Evidence Funnel + Execution Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MeasuredEvidenceProgressPanel />
          <ExecutionPipelinePanel />
        </div>

        {/* Row 5: KPIs + Baseline */}
        <DecisionKPIPanel />
        <BaselineComparison />

        {/* Row 6: Evidence Backlog */}
        <EvidenceBacklogQueue />

        {/* Row 7: Reviewer + Leaderboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReviewerAccountabilityPanel />
          <ActionLeaderboard />
        </div>

        {/* Row 8: Model History + Learning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModelPromotionLog />
          <LearningCycleHealth />
        </div>
      </div>
    </AICISLayout>
  );
}
