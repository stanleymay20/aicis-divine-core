import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AICISTopBar } from "./AICISTopBar";
import { AICISSidebar } from "./AICISSidebar";
import { AICISFooter } from "./AICISFooter";
import { useIsMobile } from "@/hooks/use-mobile";

interface AICISLayoutProps {
  children: React.ReactNode;
}

export const AICISLayout = ({ children }: AICISLayoutProps) => {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [activeSection, setActiveSection] = useState("overview");
  const location = useLocation();

  useEffect(() => {
    // Auto-detect section from route
    const path = location.pathname.split("/")[1] || "overview";
    setActiveSection(path);
  }, [location]);

  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  return (
    <div className="h-screen w-full overflow-hidden bg-background flex flex-col">
      {/* Top Status Bar */}
      <AICISTopBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <AICISSidebar 
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* Main Intelligence View */}
        <main 
          id="main-content"
          role="main"
          className={cn(
            "flex-1 overflow-auto transition-all duration-300",
            sidebarCollapsed ? "ml-0 md:ml-16" : "ml-0 md:ml-56"
          )}
        >
          {children}
        </main>
      </div>

      {/* Footer with Data Provenance */}
      <AICISFooter />
    </div>
  );
};
