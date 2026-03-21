
-- Reliability: SLA/SLO definitions per pipeline
CREATE TABLE public.sla_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name text NOT NULL UNIQUE,
  target_uptime_pct numeric NOT NULL DEFAULT 99.5,
  max_stale_hours integer NOT NULL DEFAULT 24,
  max_consecutive_failures integer NOT NULL DEFAULT 3,
  alert_channel text DEFAULT 'internal',
  slo_response_minutes integer DEFAULT 60,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sla_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sla_definitions" ON public.sla_definitions FOR SELECT USING (true);

-- Auditability: signal reproducibility chain
CREATE TABLE public.signal_audit_chain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id text NOT NULL,
  signal_type text NOT NULL,
  iso3 text,
  domain text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  model_version text,
  data_sources jsonb DEFAULT '[]',
  input_hash text,
  output_hash text,
  parameters jsonb DEFAULT '{}',
  reproducible boolean DEFAULT true,
  notes text
);

ALTER TABLE public.signal_audit_chain ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read signal_audit_chain" ON public.signal_audit_chain FOR SELECT USING (true);

-- Gov readiness scoring snapshots
CREATE TABLE public.gov_readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scored_at timestamptz DEFAULT now(),
  reliability_score numeric DEFAULT 0,
  security_score numeric DEFAULT 0,
  evidence_score numeric DEFAULT 0,
  ops_maturity_score numeric DEFAULT 0,
  overall_score numeric DEFAULT 0,
  details jsonb DEFAULT '{}',
  grade text DEFAULT 'pre-pilot'
);

ALTER TABLE public.gov_readiness_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gov_readiness_scores" ON public.gov_readiness_scores FOR SELECT USING (true);
