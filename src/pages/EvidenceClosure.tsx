import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, TrendingUp, ShieldCheck, FileBarChart, Flame } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import DailyClosureDashboard from "@/components/decision-engine/DailyClosureDashboard";
import DailyClosureWorkflow from "@/components/decision-engine/DailyClosureWorkflow";
import MeasuredOutcomeFastPath from "@/components/decision-engine/MeasuredOutcomeFastPath";
import DailyEvidenceScore from "@/components/decision-engine/DailyEvidenceScore";
import BacklogBurndown from "@/components/decision-engine/BacklogBurndown";
import MeasuredEvidenceJournal from "@/components/decision-engine/MeasuredEvidenceJournal";
import AuditCompletenessChecker from "@/components/decision-engine/AuditCompletenessChecker";
import PilotConversionReport from "@/components/decision-engine/PilotConversionReport";

export default function EvidenceClosure() {
  return (
    <AICISLayout>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto animate-fade-in">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Evidence Closure
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Daily operational closure — reduce backlog, increase measured evidence, close governance gaps
            </p>
          </div>

          {/* Top row: closure targets + evidence score */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ErrorBoundary compact><DailyClosureDashboard /></ErrorBoundary>
            </div>
            <ErrorBoundary compact><DailyEvidenceScore /></ErrorBoundary>
          </div>

          {/* Workflow + Fast Path */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ErrorBoundary compact><DailyClosureWorkflow /></ErrorBoundary>
            <ErrorBoundary compact><MeasuredOutcomeFastPath /></ErrorBoundary>
          </div>

          {/* Detailed tabs */}
          <Tabs defaultValue="burndown" className="w-full">
            <TabsList className="bg-muted/50 p-0.5 h-auto flex-wrap">
              <TabsTrigger value="burndown" className="text-xs gap-1.5 data-[state=active]:bg-card">
                <Flame className="h-3.5 w-3.5" /> Burndown
              </TabsTrigger>
              <TabsTrigger value="journal" className="text-xs gap-1.5 data-[state=active]:bg-card">
                <TrendingUp className="h-3.5 w-3.5" /> Journal
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs gap-1.5 data-[state=active]:bg-card">
                <ShieldCheck className="h-3.5 w-3.5" /> Audit Check
              </TabsTrigger>
              <TabsTrigger value="report" className="text-xs gap-1.5 data-[state=active]:bg-card">
                <FileBarChart className="h-3.5 w-3.5" /> Conversion Report
              </TabsTrigger>
            </TabsList>

            <TabsContent value="burndown" className="mt-4">
              <ErrorBoundary compact><BacklogBurndown /></ErrorBoundary>
            </TabsContent>
            <TabsContent value="journal" className="mt-4">
              <ErrorBoundary compact><MeasuredEvidenceJournal /></ErrorBoundary>
            </TabsContent>
            <TabsContent value="audit" className="mt-4">
              <ErrorBoundary compact><AuditCompletenessChecker /></ErrorBoundary>
            </TabsContent>
            <TabsContent value="report" className="mt-4">
              <ErrorBoundary compact><PilotConversionReport /></ErrorBoundary>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AICISLayout>
  );
}
