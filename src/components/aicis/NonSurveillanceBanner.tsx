/**
 * Non-Surveillance Guarantee Banner
 * Visible commitment to privacy and ethical intelligence
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShieldOff, Eye, Info, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NonSurveillanceBannerProps {
  variant?: "badge" | "banner" | "minimal";
  className?: string;
}

export const NonSurveillanceBanner = ({ 
  variant = "badge",
  className 
}: NonSurveillanceBannerProps) => {
  const navigate = useNavigate();

  if (variant === "minimal") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1 cursor-help border-success/30 text-success bg-success/10 hover:bg-success/20",
              className
            )}
          >
            <ShieldOff className="h-3 w-3" />
            <span className="text-[10px]">No Surveillance</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <p className="font-semibold">Non-Surveillance Guarantee</p>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <span className="text-success">✓</span>
                No individual tracking or monitoring
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-success">✓</span>
                No personal data collection
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-success">✓</span>
                Aggregate data only
              </li>
            </ul>
            <p className="text-muted-foreground pt-1 border-t">
              Click to view full Ethics Charter
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "badge") {
    return (
      <div 
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/30 cursor-pointer hover:bg-success/20 transition-colors",
          className
        )}
        onClick={() => navigate("/ethics")}
      >
        <ShieldOff className="h-3.5 w-3.5 text-success" />
        <span className="text-xs font-medium text-success">
          Non-Surveillance Intelligence
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-success/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            <p>AICIS operates on aggregate public data only — no individuals are tracked</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Full banner
  return (
    <div 
      className={cn(
        "p-4 rounded-lg bg-success/5 border border-success/20",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-success/10">
          <ShieldOff className="h-6 w-6 text-success" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-success">Non-Surveillance Guarantee</h4>
            <Badge variant="outline" className="text-[10px] border-success/30 text-success">
              Core Principle
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <Eye className="h-4 w-4 text-success/60 mt-0.5" />
              <div>
                <p className="font-medium">No Individual Tracking</p>
                <p className="text-muted-foreground">Personal behavior never monitored</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldOff className="h-4 w-4 text-success/60 mt-0.5" />
              <div>
                <p className="font-medium">No Personal Data</p>
                <p className="text-muted-foreground">Only aggregate public intelligence</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-success/60 mt-0.5" />
              <div>
                <p className="font-medium">Full Transparency</p>
                <p className="text-muted-foreground">All data sources visible</p>
              </div>
            </div>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="border-success/30 text-success hover:bg-success/10"
          onClick={() => navigate("/ethics")}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Ethics Charter
        </Button>
      </div>
    </div>
  );
};
