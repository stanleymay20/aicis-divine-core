/**
 * Atlas Research Engine
 * Background multi-agent research pipeline feeding AICIS Validation Layer
 * 
 * Atlas is NOT exposed directly to end-users.
 * It operates as AICIS Layer 1: Research & Signal Intake
 */

import { supabase } from '@/integrations/supabase/client';
import type { 
  AtlasSignal, 
  AtlasPipelineStatus, 
  SignalCategory,
  AtlasToAICISHandoff 
} from './types';

class AtlasResearchEngine {
  private static instance: AtlasResearchEngine;
  private isRunning = false;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  
  private constructor() {}
  
  static getInstance(): AtlasResearchEngine {
    if (!AtlasResearchEngine.instance) {
      AtlasResearchEngine.instance = new AtlasResearchEngine();
    }
    return AtlasResearchEngine.instance;
  }
  
  /**
   * Start the Atlas background research pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[Atlas] Research engine started');
    
    // Run initial scan
    await this.runResearchCycle();
    
    // Schedule periodic scans (every 5 minutes for real-time signal detection)
    this.scanInterval = setInterval(() => {
      this.runResearchCycle();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Stop the Atlas pipeline
   */
  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isRunning = false;
    console.log('[Atlas] Research engine stopped');
  }
  
  /**
   * Get current pipeline status
   */
  async getStatus(): Promise<AtlasPipelineStatus> {
    // Query from data_source_log and intel_events for real metrics
    const [sourceLog, intelEvents] = await Promise.all([
      supabase
        .from('data_source_log')
        .select('*', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('intel_events')
        .select('*', { count: 'exact' })
        .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    ]);
    
    return {
      isActive: this.isRunning,
      lastScan: new Date().toISOString(),
      signalsInQueue: 0, // Would come from a queue table
      signalsProcessed24h: intelEvents.count || 0,
      sourcesMonitored: sourceLog.count || 0,
      currentFocus: ['security', 'health', 'economic', 'climate']
    };
  }
  
  /**
   * Main research cycle - scans sources and generates signals
   */
  private async runResearchCycle(): Promise<void> {
    console.log('[Atlas] Running research cycle...');
    
    try {
      // 1. Scan for weak signals across domains
      await this.scanForSignals();
      
      // 2. Detect anomalies
      await this.detectAnomalies();
      
      // 3. Generate cross-domain correlations
      await this.findCorrelations();
      
      console.log('[Atlas] Research cycle complete');
    } catch (error) {
      console.error('[Atlas] Research cycle error:', error);
    }
  }
  
  /**
   * Scan public sources for emerging signals
   */
  private async scanForSignals(): Promise<AtlasSignal[]> {
    // Pull from intel_events and critical_alerts
    const { data: events } = await supabase
      .from('intel_events')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(50);
    
    if (!events) return [];
    
    // Transform to Atlas signals
    const signals: AtlasSignal[] = events.map(event => ({
      id: event.id,
      category: this.mapDivisionToCategory(event.division),
      strength: this.calculateSignalStrength(event.severity),
      status: 'detected' as const,
      title: event.title,
      summary: event.description || '',
      rawSources: [{
        name: event.division,
        type: 'aggregator' as const,
        retrievedAt: event.published_at,
        reliability: 'high' as const
      }],
      detectedAt: event.published_at,
      preliminaryConfidence: Math.min(event.severity === 'critical' ? 85 : 70, 95)
    }));
    
    return signals;
  }
  
  /**
   * Detect anomalies from anomaly_detections table
   */
  private async detectAnomalies(): Promise<void> {
    const { data: anomalies } = await supabase
      .from('anomaly_detections')
      .select('*')
      .eq('status', 'active')
      .order('detected_at', { ascending: false })
      .limit(20);
    
    // Anomalies are already tracked - Atlas just monitors them
    console.log(`[Atlas] Monitoring ${anomalies?.length || 0} active anomalies`);
  }
  
  /**
   * Find cross-domain correlations
   */
  private async findCorrelations(): Promise<void> {
    // This would analyze patterns across divisions
    // For now, we check if multiple divisions are affected by similar events
    const { data: recentEvents } = await supabase
      .from('intel_events')
      .select('division, severity')
      .gte('published_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
    
    if (recentEvents && recentEvents.length > 5) {
      const criticalDivisions = new Set(
        recentEvents.filter(e => e.severity === 'critical').map(e => e.division)
      );
      
      if (criticalDivisions.size >= 2) {
        console.log(`[Atlas] Cross-domain correlation detected: ${Array.from(criticalDivisions).join(', ')}`);
      }
    }
  }
  
  /**
   * Hand off validated signal to AICIS Layer 2
   */
  async handoffToValidation(signalId: string): Promise<AtlasToAICISHandoff> {
    return {
      signalId,
      handoffTime: new Date().toISOString(),
      atlasConfidence: 70,
      atlasCategory: 'security',
      atlasSummary: 'Signal ready for validation',
      claimsToVerify: [],
      suggestedSources: [],
      validationStatus: 'pending'
    };
  }
  
  /**
   * Map division to signal category
   */
  private mapDivisionToCategory(division: string): SignalCategory {
    const mapping: Record<string, SignalCategory> = {
      finance: 'economic',
      energy: 'energy',
      health: 'health',
      food: 'food',
      defense: 'security',
      diplomacy: 'geopolitical',
      crisis: 'security',
      governance: 'geopolitical',
      system: 'technology'
    };
    return mapping[division] || 'geopolitical';
  }
  
  /**
   * Calculate signal strength from severity
   */
  private calculateSignalStrength(severity: string): 'weak' | 'moderate' | 'strong' {
    if (severity === 'critical' || severity === 'emergency') return 'strong';
    if (severity === 'warning') return 'moderate';
    return 'weak';
  }
}

// Export singleton instance
export const atlasEngine = AtlasResearchEngine.getInstance();
