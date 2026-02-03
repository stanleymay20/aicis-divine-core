/**
 * Atlas Research Engine Status Badge
 * Shows the background research pipeline status
 * Atlas is AICIS Layer 1 - not directly exposed to users
 */
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Radio, 
  Activity,
  Database
} from 'lucide-react';
import { atlasEngine } from '@/lib/atlas/AtlasEngine';
import type { AtlasPipelineStatus } from '@/lib/atlas/types';

interface AtlasStatusBadgeProps {
  className?: string;
  compact?: boolean;
}

export const AtlasStatusBadge = ({ className, compact = false }: AtlasStatusBadgeProps) => {
  const [status, setStatus] = useState<AtlasPipelineStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    // Start Atlas engine if not running
    atlasEngine.start();
    
    // Get initial status
    atlasEngine.getStatus().then(setStatus);
    
    // Poll for status updates
    const interval = setInterval(() => {
      atlasEngine.getStatus().then(setStatus);
    }, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  if (!status) return null;
  
  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1 text-[10px] cursor-default",
          status.isActive 
            ? "border-primary/30 text-primary bg-primary/10" 
            : "border-muted-foreground/30 text-muted-foreground",
          className
        )}
      >
        <Radio className={cn(
          "h-2.5 w-2.5",
          status.isActive && "animate-pulse"
        )} />
        Atlas
      </Badge>
    );
  }
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs",
            status.isActive ? "text-primary" : "text-muted-foreground",
            className
          )}
        >
          <Radio className={cn(
            "h-3 w-3",
            status.isActive && "animate-pulse"
          )} />
          <span className="hidden sm:inline">Atlas Research</span>
          {status.isActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Atlas Research Engine</span>
            </div>
            <Badge 
              variant={status.isActive ? "default" : "secondary"}
              className="text-[10px]"
            >
              {status.isActive ? "Active" : "Standby"}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Layer 1: Continuous signal detection and weak trend identification across global sources.
          </p>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3 w-3" />
                Signals processed (24h)
              </span>
              <span className="font-mono font-medium">{status.signalsProcessed24h}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                Sources monitored
              </span>
              <span className="font-mono font-medium">{status.sourcesMonitored}</span>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Current Focus Areas</span>
            <div className="flex flex-wrap gap-1">
              {status.currentFocus.map((focus) => (
                <Badge 
                  key={focus} 
                  variant="outline" 
                  className="text-[10px] capitalize"
                >
                  {focus}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
            Last scan: {new Date(status.lastScan).toLocaleTimeString()}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
