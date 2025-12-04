import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { NotificationsCenter } from "@/components/NotificationsCenter";
import { ChatDashboard } from "@/components/dashboards/ChatDashboard";
import { VisualizationDashboard } from "@/components/dashboards/VisualizationDashboard";
import { VideoDashboard } from "@/components/dashboards/VideoDashboard";
import { SatelliteDashboard } from "@/components/dashboards/SatelliteDashboard";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [activeView, setActiveView] = useState("chat");
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
        
        <main className="container mx-auto px-4 py-6">
          {activeView === "chat" && <ChatDashboard />}
          {activeView === "visualizations" && <VisualizationDashboard />}
          {activeView === "video" && <VideoDashboard />}
          {activeView === "satellite" && <SatelliteDashboard />}
        </main>
      </div>

      {/* Ambient glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[128px] pointer-events-none" />
    </div>
  );
};

export default Index;
