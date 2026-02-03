/**
 * Global Ethics Guarantee Banner
 * Displayed on EVERY page to ensure non-surveillance guarantee is always visible
 */
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShieldOff, FileText, ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GlobalEthicsGuaranteeProps {
  variant?: 'banner' | 'badge' | 'minimal';
  className?: string;
}

export const GlobalEthicsGuarantee = ({ 
  variant = 'badge',
  className 
}: GlobalEthicsGuaranteeProps) => {
  const navigate = useNavigate();
  
  if (variant === 'banner') {
    return (
      <div className={cn(
        "w-full px-4 py-2 bg-success/10 border-b border-success/20",
        "flex items-center justify-center gap-3",
        className
      )}>
        <ShieldOff className="h-4 w-4 text-success" />
        <span className="text-xs text-success font-medium">
          Non-Surveillance Guarantee: AICIS analyzes systems, not people. No personal data collected.
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-success underline"
          onClick={() => navigate('/ethics')}
        >
          View Ethics Charter
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }
  
  if (variant === 'minimal') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1 text-[9px] cursor-pointer hover:bg-success/10 transition-colors",
              "border-success/30 text-success",
              className
            )}
            onClick={() => navigate('/ethics')}
          >
            <ShieldOff className="h-2.5 w-2.5" />
            Ethics
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="font-medium">Non-Surveillance Guarantee</p>
          <p className="text-muted-foreground">
            AICIS uses only aggregate, public data. No individual tracking.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  // Default badge variant
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full cursor-pointer",
            "bg-success/10 border border-success/30",
            "hover:bg-success/20 transition-colors",
            className
          )}
          onClick={() => navigate('/ethics')}
        >
          <ShieldOff className="h-3 w-3 text-success" />
          <span className="text-[10px] font-medium text-success hidden sm:inline">
            Non-Surveillance
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        <p className="font-medium">Non-Surveillance Guarantee</p>
        <p className="text-muted-foreground">
          No individuals tracked — aggregate intelligence only
        </p>
        <p className="text-primary mt-1 flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Click to view full Ethics Charter
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Footer ethics statement for every page
 */
export const EthicsFooterStatement = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  
  return (
    <div className={cn(
      "flex items-center justify-center gap-2 py-2 text-[10px] text-muted-foreground",
      className
    )}>
      <ShieldOff className="h-3 w-3 text-success" />
      <span>AICIS analyzes systems, not people.</span>
      <span className="text-border">|</span>
      <button 
        className="text-primary hover:underline"
        onClick={() => navigate('/ethics')}
      >
        Ethics Charter
      </button>
    </div>
  );
};
