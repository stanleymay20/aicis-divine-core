import { AICISLayout } from "@/components/aicis/AICISLayout";
import { MorningBriefDashboard } from "@/components/morning-brief/MorningBriefDashboard";

export default function MorningBrief() {
  return (
    <AICISLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto overflow-y-auto h-full">
        <MorningBriefDashboard />
      </div>
    </AICISLayout>
  );
}
