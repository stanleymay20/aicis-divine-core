/**
 * Tiered Alert System
 * Implements alert routing based on severity:
 * - Low → Monitor (system tracks)
 * - Medium → Analyst attention required
 * - High → Executive attention required  
 * - Critical → Human approval required before any action
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  AlertCircle,
  Bell,
  Eye,
  User,
  UserCog,
  ShieldCheck,
  Clock,
  Check,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export type AlertTier = 'low' | 'medium' | 'high' | 'critical';

export interface TieredAlert {
  id: string;
  title: string;
  message: string;
  tier: AlertTier;
  division: string;
  country?: string;
  created_at: string;
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  acknowledged: boolean;
}

const TIER_CONFIG: Record<AlertTier, {
  label: string;
  icon: typeof Bell;
  color: string;
  bgColor: string;
  borderColor: string;
  attention: string;
  requiresApproval: boolean;
}> = {
  low: {
    label: 'Monitor',
    icon: Eye,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    borderColor: 'border-border/50',
    attention: 'System monitors automatically',
    requiresApproval: false
  },
  medium: {
    label: 'Analyst',
    icon: User,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    attention: 'Analyst attention required',
    requiresApproval: false
  },
  high: {
    label: 'Executive',
    icon: UserCog,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    attention: 'Executive attention required',
    requiresApproval: false
  },
  critical: {
    label: 'Approval Required',
    icon: ShieldCheck,
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
    borderColor: 'border-destructive/50',
    attention: 'Human approval required before action',
    requiresApproval: true
  }
};

/**
 * Map severity string to tier
 */
export function mapSeverityToTier(severity: string): AlertTier {
  const mapping: Record<string, AlertTier> = {
    info: 'low',
    low: 'low',
    medium: 'medium',
    warning: 'medium',
    high: 'high',
    critical: 'critical',
    emergency: 'critical'
  };
  return mapping[severity?.toLowerCase()] || 'low';
}

interface TieredAlertSystemProps {
  className?: string;
  showOnlyTier?: AlertTier;
  compact?: boolean;
}

export const TieredAlertSystem = ({ 
  className,
  showOnlyTier,
  compact = false
}: TieredAlertSystemProps) => {
  const { data: alerts = [], refetch } = useQuery({
    queryKey: ['tiered-alerts', showOnlyTier],
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (showOnlyTier) {
        const severities = {
          low: ['info', 'low'],
          medium: ['medium', 'warning'],
          high: ['high'],
          critical: ['critical', 'emergency']
        };
        query = query.in('severity', severities[showOnlyTier]);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Map to tiered alerts
      return (data || []).map(alert => ({
        ...alert,
        tier: mapSeverityToTier(alert.severity),
        requires_approval: alert.severity === 'critical',
      })) as TieredAlert[];
    }
  });
  
  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('tiered-alerts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => refetch()
      )
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);
  
  const handleApprove = async (alertId: string) => {
    const { error } = await supabase
      .from('alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: 'current-user' // Would be actual user ID
      })
      .eq('id', alertId);
    
    if (error) {
      toast.error('Failed to approve alert');
    } else {
      toast.success('Alert approved');
      refetch();
    }
  };
  
  const handleDismiss = async (alertId: string) => {
    const { error } = await supabase
      .from('alerts')
      .update({ acknowledged: true })
      .eq('id', alertId);
    
    if (!error) refetch();
  };
  
  // Group alerts by tier
  const groupedAlerts = alerts.reduce((acc, alert) => {
    const tier = alert.tier;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(alert);
    return acc;
  }, {} as Record<AlertTier, TieredAlert[]>);
  
  const tierOrder: AlertTier[] = ['critical', 'high', 'medium', 'low'];
  
  if (compact) {
    // Compact mode for embedding in headers/sidebars
    const criticalCount = groupedAlerts.critical?.filter(a => !a.acknowledged).length || 0;
    const highCount = groupedAlerts.high?.filter(a => !a.acknowledged).length || 0;
    
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="animate-pulse">
            {criticalCount} Approval Required
          </Badge>
        )}
        {highCount > 0 && (
          <Badge variant="destructive">
            {highCount} Executive
          </Badge>
        )}
      </div>
    );
  }
  
  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Tiered Alert System
          </span>
          <Badge variant="outline" className="text-[10px]">
            {alerts.filter(a => !a.acknowledged).length} Active
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Alerts routed by severity — Critical requires human approval
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-3">
          <div className="space-y-4">
            {tierOrder.map(tier => {
              const tierAlerts = groupedAlerts[tier];
              if (!tierAlerts || tierAlerts.length === 0) return null;
              
              const config = TIER_CONFIG[tier];
              const Icon = config.icon;
              const unacknowledged = tierAlerts.filter(a => !a.acknowledged);
              
              return (
                <div key={tier} className="space-y-2">
                  {/* Tier Header */}
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg",
                    config.bgColor,
                    "border",
                    config.borderColor
                  )}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", config.color)} />
                      <span className={cn("font-medium text-sm", config.color)}>
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({config.attention})
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {unacknowledged.length} active
                    </Badge>
                  </div>
                  
                  {/* Tier Alerts */}
                  <div className="space-y-2 pl-4">
                    {tierAlerts.slice(0, 5).map(alert => (
                      <div 
                        key={alert.id}
                        className={cn(
                          "p-3 rounded-lg border transition-all",
                          alert.acknowledged 
                            ? "opacity-50 bg-muted/20 border-border/30" 
                            : cn(config.bgColor, config.borderColor)
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">
                                {alert.title}
                              </span>
                              {alert.requires_approval && !alert.acknowledged && (
                                <Badge variant="destructive" className="text-[9px] px-1.5">
                                  Pending Approval
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {alert.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(alert.created_at).toLocaleString()}
                              {alert.division && (
                                <>
                                  <span>•</span>
                                  <span>{alert.division}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          {!alert.acknowledged && (
                            <div className="flex items-center gap-1">
                              {alert.requires_approval ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-success hover:text-success hover:bg-success/20"
                                    onClick={() => handleApprove(alert.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/20"
                                    onClick={() => handleDismiss(alert.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => handleDismiss(alert.id)}
                                >
                                  Acknowledge
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {alerts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active alerts</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

/**
 * Compact tier indicator for alerts
 */
export const AlertTierBadge = ({ tier }: { tier: AlertTier }) => {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 text-[10px]",
        config.borderColor,
        config.color
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};
