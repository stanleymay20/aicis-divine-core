import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { SystemStatus } from "@/components/SystemStatus";
import { DivisionGrid } from "@/components/DivisionGrid";
import { CommandInterface } from "@/components/CommandInterface";
import { MetricsPanel } from "@/components/MetricsPanel";
import { FinancialPanel } from "@/components/FinancialPanel";
import { HealthcarePanel } from "@/components/HealthcarePanel";
import { FoodSecurityPanel } from "@/components/FoodSecurityPanel";
import { GovernancePanel } from "@/components/GovernancePanel";
import { DefensePanel } from "@/components/DefensePanel";
import { DiplomacyPanel } from "@/components/DiplomacyPanel";
import { CrisisPanel } from "@/components/CrisisPanel";
import { IntelligenceHub } from "@/components/IntelligenceHub";
import { EventBusMonitor } from "@/components/EventBusMonitor";
import { ExecutivePanel } from "@/components/ExecutivePanel";
import { ObjectivePanel } from "@/components/ObjectivePanel";
import EconomyPanel from "@/components/EconomyPanel";
import { UnifiedGovernancePanel } from "@/components/UnifiedGovernancePanel";
import { NotificationsCenter } from "@/components/NotificationsCenter";
import { AutomationMonitorPanel } from "@/components/AutomationMonitorPanel";
import LearningAllocatorPanel from "@/components/LearningAllocatorPanel";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [activeView, setActiveView] = useState("overview");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-2xl font-orbitron">Initializing AICIS...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Animated background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,hsl(189_40%_20%_/_0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(189_40%_20%_/_0.1)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      
      {/* Notifications Button - Fixed Position */}
      <div className="fixed top-4 right-4 z-50">
        <NotificationsCenter />
      </div>
      
      <div className="relative z-10">
        <DashboardHeader activeView={activeView} setActiveView={setActiveView} />
        
        <main className="container mx-auto px-4 py-6 space-y-6">
          {activeView === "overview" && (
            <>
              <SystemStatus />
              <MetricsPanel />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ExecutivePanel />
                <ObjectivePanel />
                <EconomyPanel />
              </div>
              
              <IntelligenceHub />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <EventBusMonitor />
                <FinancialPanel />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <HealthcarePanel />
                <FoodSecurityPanel />
              </div>
              
              <UnifiedGovernancePanel />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DefensePanel />
                <GovernancePanel />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DiplomacyPanel />
                <CrisisPanel />
              </div>
              
              <DivisionGrid />
            </>
          )}
          
          {activeView === "economy" && <EconomyPanel />}
          {activeView === "health" && <HealthcarePanel />}
          {activeView === "food" && <FoodSecurityPanel />}
          {activeView === "energy" && (
            <div className="space-y-6">
              <SystemStatus />
              <MetricsPanel />
            </div>
          )}
          {activeView === "governance" && <UnifiedGovernancePanel />}
          {activeView === "dao" && <UnifiedGovernancePanel />}
          {activeView === "automation" && <AutomationMonitorPanel />}
          {activeView === "learning" && <LearningAllocatorPanel />}
          
          <CommandInterface />
        </main>
      </div>

      {/* Ambient glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[128px] pointer-events-none" />
    </div>
  );
};

export default Index;
