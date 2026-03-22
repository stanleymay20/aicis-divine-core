import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

export const AICISFooter = () => {
  return (
    <footer className="h-8 bg-card border-t border-border flex items-center justify-center px-4 z-40 shrink-0">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Shield className="h-3 w-3" />
        <span>AICIS — Aggregate intelligence only. No personal data collected.</span>
      </div>
    </footer>
  );
};
