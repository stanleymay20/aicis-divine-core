/**
 * Mode-Aware Section Wrapper
 * Dynamically shows/hides or changes density based on Executive vs Analyst mode
 */
import { ReactNode } from "react";
import { useViewModePersistence } from "@/hooks/useViewModePersistence";
import { Badge } from "@/components/ui/badge";
import { Eye, Microscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeAwareSectionProps {
  children: ReactNode;
  /** Only show in this mode. Omit to show in both */
  onlyIn?: "executive" | "analyst";
  /** Show a compact version in executive mode */
  compactInExecutive?: boolean;
  /** Executive-specific children (if different from children) */
  executiveChildren?: ReactNode;
  /** Show mode indicator badge */
  showModeBadge?: boolean;
  className?: string;
}

export const ModeAwareSection = ({
  children,
  onlyIn,
  compactInExecutive = false,
  executiveChildren,
  showModeBadge = false,
  className,
}: ModeAwareSectionProps) => {
  const { mode } = useViewModePersistence();

  // If restricted to a specific mode and current mode doesn't match, hide
  if (onlyIn && mode !== onlyIn) return null;

  const isExecutive = mode === "executive";

  // If executive-specific children are provided, show those in executive mode
  if (isExecutive && executiveChildren) {
    return (
      <div className={cn(className)}>
        {showModeBadge && (
          <Badge variant="outline" className="mb-2 text-[10px] gap-1 border-primary/20">
            <Eye className="h-2.5 w-2.5" /> Executive View
          </Badge>
        )}
        {executiveChildren}
      </div>
    );
  }

  return (
    <div className={cn(
      compactInExecutive && isExecutive && "max-h-[300px] overflow-hidden relative",
      className
    )}>
      {showModeBadge && !isExecutive && (
        <Badge variant="outline" className="mb-2 text-[10px] gap-1 border-secondary/20">
          <Microscope className="h-2.5 w-2.5" /> Analyst View
        </Badge>
      )}
      {children}
      {compactInExecutive && isExecutive && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      )}
    </div>
  );
};

/**
 * Executive Summary Card - "So What / Now What" brief
 */
interface ExecutiveBriefProps {
  soWhat: string;
  nowWhat: string;
  className?: string;
}

export const ExecutiveBrief = ({ soWhat, nowWhat, className }: ExecutiveBriefProps) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3", className)}>
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-xs font-semibold text-primary mb-1">So What?</p>
        <p className="text-sm text-foreground">{soWhat}</p>
      </div>
      <div className="p-3 rounded-lg bg-success/5 border border-success/20">
        <p className="text-xs font-semibold text-success mb-1">Now What?</p>
        <p className="text-sm text-foreground">{nowWhat}</p>
      </div>
    </div>
  );
};
