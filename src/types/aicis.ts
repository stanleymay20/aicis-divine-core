/**
 * AICIS Enterprise Type Definitions
 * Centralized types for type safety across the application
 */

// ============================================
// Division & Status Types
// ============================================

export type DivisionKey = 
  | 'finance' 
  | 'energy' 
  | 'health' 
  | 'food' 
  | 'defense' 
  | 'diplomacy' 
  | 'crisis' 
  | 'governance'
  | 'system';

export type DivisionStatus = 'operational' | 'active' | 'degraded' | 'offline';

export type SeverityLevel = 'info' | 'warning' | 'critical' | 'emergency';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AlertLevel = 'stable' | 'monitoring' | 'warning' | 'critical' | 'emergency';

// ============================================
// Intelligence & Events
// ============================================

export interface IntelEvent {
  id: string;
  division: DivisionKey;
  event_type: string;
  severity: SeverityLevel;
  title: string;
  description: string | null;
  published_at: string;
  payload?: Record<string, unknown>;
}

export interface IntelligenceIndex {
  id: string;
  index_type: string;
  title: string;
  summary_md: string | null;
  priority: number;
  confidence_score: number;
  affected_divisions: string[];
  generated_at: string;
}

export interface RiskPrediction {
  id: string;
  title: string;
  description_md: string | null;
  risk_level: RiskLevel;
  probability: number;
  impact_score: number;
  affected_divisions: string[];
  predicted_timeframe: string;
  confidence_level: number;
}

export interface AnomalyDetection {
  id: string;
  division: DivisionKey;
  anomaly_type: string;
  severity: RiskLevel;
  status: 'active' | 'resolved' | 'investigating';
  description: string;
  deviation_percentage: number | null;
  detected_at: string;
}

// ============================================
// Diagnostics & Health
// ============================================

export interface FailedApi {
  name: string;
  error: string;
  status?: number;
}

export interface DiagnosticResult {
  status: 'healthy' | 'degraded' | 'down';
  missing_env: string[];
  failed_apis: FailedApi[];
  failed_tables: string[];
  latency_ms: number;
  timestamp?: string;
}

export interface SystemHealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time_ms?: number;
  error_message?: string;
}

// ============================================
// Governance & Assets
// ============================================

export interface GovernanceAsset {
  id: string;
  asset_symbol: string;
  asset_name: string;
  description_md?: string;
  source_system: string;
  current_price?: number;
  enabled: boolean;
}

export interface GovernancePartner {
  id: string;
  partner_name: string;
  trust_score: number;
  enabled: boolean;
  last_checked: string;
}

export interface GovernanceTrade {
  id: string;
  asset_symbol: string;
  asset_amount: number;
  price: number;
  sc_amount: number;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  created_at: string;
}

export interface GovernanceAssetsResponse {
  assets: GovernanceAsset[];
  partners: GovernancePartner[];
  scPrice?: {
    value: number;
  };
}

// ============================================
// Division Data
// ============================================

export interface AiDivision {
  id: string;
  division_key: DivisionKey;
  name: string;
  status: DivisionStatus;
  uptime_percentage: number;
  performance_score: number;
  last_check: string;
}

export interface CrisisEvent {
  id: string;
  region: string;
  kind: string;
  severity: number | null;
  status: string | null;
  opened_at: string | null;
  resolved_at: string | null;
  details_md: string | null;
}

// ============================================
// Objectives & Tasks
// ============================================

export interface Objective {
  id: string;
  objective_text: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  priority: number;
  ai_plan: unknown[];
  ai_summary: string | null;
  created_at: string;
  objective_tasks?: { count: number }[];
}

// ============================================
// Federation
// ============================================

export interface FederationPeer {
  id: string;
  peer_name: string;
  base_url: string;
  pubkey_pem: string;
  trust_score: number | null;
  send_enabled: boolean | null;
  recv_enabled: boolean | null;
  last_seen: string | null;
}

export interface FederationPolicy {
  id: string;
  enabled: boolean | null;
  share_divisions: string[];
  dp_epsilon: number | null;
  min_sample: number | null;
  max_daily_weight_drift: number | null;
  jurisdiction: string | null;
  data_classification: string | null;
}

// ============================================
// Badge Variant Helpers
// ============================================

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export const SEVERITY_BADGE_VARIANTS: Record<SeverityLevel, BadgeVariant> = {
  info: 'outline',
  warning: 'secondary',
  critical: 'destructive',
  emergency: 'destructive',
};

export const RISK_BADGE_VARIANTS: Record<RiskLevel, BadgeVariant> = {
  low: 'outline',
  medium: 'secondary',
  high: 'destructive',
  critical: 'destructive',
};

export const STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  pending: 'outline',
  executing: 'default',
  completed: 'default',
  failed: 'destructive',
};

// ============================================
// Color Mapping (semantic tokens)
// ============================================

export const DIVISION_COLORS: Record<DivisionKey, string> = {
  finance: 'text-success',
  energy: 'text-warning',
  health: 'text-destructive',
  food: 'text-warning',
  governance: 'text-primary',
  defense: 'text-secondary',
  diplomacy: 'text-accent-foreground',
  crisis: 'text-destructive',
  system: 'text-muted-foreground',
};

// ============================================
// Error Handling
// ============================================

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}
