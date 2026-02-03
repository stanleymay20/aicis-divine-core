/**
 * Atlas Research Layer - Type Definitions
 * Atlas operates as the Research Engine feeding AICIS Validation Layer
 */

export type SignalCategory = 
  | 'geopolitical'
  | 'health'
  | 'economic'
  | 'security'
  | 'climate'
  | 'food'
  | 'energy'
  | 'technology';

export type SignalStrength = 'weak' | 'moderate' | 'strong';

export type SignalStatus = 'detected' | 'processing' | 'validated' | 'rejected';

/**
 * A raw signal detected by Atlas research agents
 * These feed into AICIS Layer 2 (Validation)
 */
export interface AtlasSignal {
  id: string;
  category: SignalCategory;
  strength: SignalStrength;
  status: SignalStatus;
  
  // Content
  title: string;
  summary: string;
  rawSources: AtlasSource[];
  
  // Metadata
  detectedAt: string;
  region?: string;
  country?: string;
  
  // Research layer scoring (pre-validation)
  preliminaryConfidence: number; // 0-100, will be capped at 95 after validation
  anomalyScore?: number;
  trendIndicator?: 'rising' | 'stable' | 'declining';
  
  // Cross-domain correlations
  correlatedSignals?: string[];
}

export interface AtlasSource {
  name: string;
  type: 'news' | 'research' | 'government' | 'ngo' | 'satellite' | 'aggregator';
  url?: string;
  retrievedAt: string;
  reliability: 'high' | 'medium' | 'low';
}

/**
 * Atlas Research Brief - Long-form analysis for human review
 */
export interface AtlasResearchBrief {
  id: string;
  title: string;
  category: SignalCategory;
  
  // Content
  executiveSummary: string;
  detailedAnalysis: string;
  keyFindings: string[];
  uncertainties: string[];
  
  // Sources
  sources: AtlasSource[];
  signalIds: string[]; // Related signals
  
  // Metadata
  createdAt: string;
  author: 'atlas-research-engine';
  
  // Pre-validation scoring
  dataCompleteness: number;
  sourcesDiversity: number;
}

/**
 * Atlas Pipeline Status
 */
export interface AtlasPipelineStatus {
  isActive: boolean;
  lastScan: string;
  signalsInQueue: number;
  signalsProcessed24h: number;
  sourcesMonitored: number;
  currentFocus: SignalCategory[];
}

/**
 * Atlas → AICIS Handoff
 * Signals that pass to Layer 2 (Validation)
 */
export interface AtlasToAICISHandoff {
  signalId: string;
  handoffTime: string;
  
  // What Atlas determined
  atlasConfidence: number;
  atlasCategory: SignalCategory;
  atlasSummary: string;
  
  // What AICIS Validation needs to verify
  claimsToVerify: string[];
  suggestedSources: string[];
  
  // Status
  validationStatus: 'pending' | 'in_progress' | 'complete';
}
