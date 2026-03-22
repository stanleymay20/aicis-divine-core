import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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
    const path = location.pathname.split("/")[1] || "overview";
    setActiveSection(path);
  }, [location]);

  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  return (
    <div className="h-screen w-full overflow-hidden bg-background flex flex-col">
      <AICISTopBar />
      <div className="flex-1 flex overflow-hidden">
        <AICISSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <main
          id="main-content"
          role="main"
          className={cn(
            "flex-1 overflow-auto transition-all duration-200",
            sidebarCollapsed ? "ml-0 md:ml-[60px]" : "ml-0 md:ml-[220px]"
          )}
        >
          {children}
        </main>
      </div>
      <AICISFooter />
    </div>
  );
};
