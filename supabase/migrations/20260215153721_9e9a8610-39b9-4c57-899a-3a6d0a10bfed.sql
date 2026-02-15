
-- ═══════════════════════════════════════════════════════════════
-- 1. MODEL REGISTRY — Version governance for all engine versions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.model_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version text NOT NULL UNIQUE,
  release_date timestamptz NOT NULL DEFAULT now(),
  alpha_default numeric NOT NULL DEFAULT 0.6,
  beta_default numeric NOT NULL DEFAULT 0.7,
  structural_break_method text NOT NULL DEFAULT 'CUSUM-Holt',
  fragility_model_version text NOT NULL DEFAULT '1.0',
  weight_vector_hash text,
  git_commit_hash text,
  notes text,
  status text NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'superseded', 'deprecated')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one model can be 'current' at a time
CREATE UNIQUE INDEX idx_model_registry_current ON public.model_registry (status) WHERE status = 'current';

ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_registry_read" ON public.model_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "model_registry_write" ON public.model_registry FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "model_registry_update" ON public.model_registry FOR UPDATE TO service_role USING (true);

-- Seed initial model version
INSERT INTO public.model_registry (model_version, alpha_default, beta_default, structural_break_method, fragility_model_version, status, notes)
VALUES ('APE-V2.1', 0.6, 0.7, 'CUSUM-Holt', '1.0', 'current', 'Initial production model with k-fold cross-validation calibration');

-- ═══════════════════════════════════════════════════════════════
-- 2. DOMAIN WEIGHTS — Database-driven weight governance
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.domain_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version text NOT NULL REFERENCES public.model_registry(model_version),
  domain text NOT NULL,
  weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(model_version, domain)
);

ALTER TABLE public.domain_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_weights_read" ON public.domain_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "domain_weights_write" ON public.domain_weights FOR INSERT TO service_role WITH CHECK (true);

-- Seed default weights for APE-V2.1
INSERT INTO public.domain_weights (model_version, domain, weight, rationale) VALUES
  ('APE-V2.1', 'health', 0.20, 'Population wellbeing baseline'),
  ('APE-V2.1', 'economy', 0.20, 'Economic stability driver'),
  ('APE-V2.1', 'governance', 0.18, 'Institutional quality'),
  ('APE-V2.1', 'security', 0.15, 'Physical and cyber stability'),
  ('APE-V2.1', 'education', 0.12, 'Human capital development'),
  ('APE-V2.1', 'environment', 0.10, 'Environmental sustainability'),
  ('APE-V2.1', 'infrastructure', 0.05, 'Physical infrastructure');

-- ═══════════════════════════════════════════════════════════════
-- 3. FORECAST ARCHIVE — Immutable, INSERT-only forecast snapshots
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.forecast_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso3 text NOT NULL,
  country_name text NOT NULL,
  domain text NOT NULL,
  model_version text NOT NULL REFERENCES public.model_registry(model_version),
  alpha numeric,
  beta numeric,
  performance_index numeric,
  forecast_90d numeric,
  forecast_1y numeric,
  forecast_upper_80 numeric,
  forecast_lower_80 numeric,
  forecast_upper_95 numeric,
  forecast_lower_95 numeric,
  confidence_score numeric,
  stability_score numeric,
  structural_break_flag boolean DEFAULT false,
  structural_break_p_value numeric,
  data_stale_days integer DEFAULT 0,
  data_quality_score numeric,
  gap_interpolation_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Prevent UPDATE and DELETE via trigger
CREATE OR REPLACE FUNCTION public.prevent_forecast_archive_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'forecast_archive is immutable — UPDATE and DELETE are prohibited';
END;
$$;

CREATE TRIGGER trg_forecast_archive_no_update
  BEFORE UPDATE ON public.forecast_archive FOR EACH ROW
  EXECUTE FUNCTION public.prevent_forecast_archive_mutation();

CREATE TRIGGER trg_forecast_archive_no_delete
  BEFORE DELETE ON public.forecast_archive FOR EACH ROW
  EXECUTE FUNCTION public.prevent_forecast_archive_mutation();

CREATE INDEX idx_forecast_archive_iso3_domain ON public.forecast_archive (iso3, domain, created_at DESC);
CREATE INDEX idx_forecast_archive_version ON public.forecast_archive (model_version);

ALTER TABLE public.forecast_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forecast_archive_read" ON public.forecast_archive FOR SELECT TO authenticated USING (true);
CREATE POLICY "forecast_archive_write" ON public.forecast_archive FOR INSERT TO service_role WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 4. FORECAST OUTCOMES — Reconciliation of predictions vs reality
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.forecast_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_archive_id uuid NOT NULL REFERENCES public.forecast_archive(id),
  realized_value numeric,
  realized_date date,
  absolute_error numeric,
  squared_error numeric,
  inside_80_band boolean,
  inside_95_band boolean,
  bias numeric,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(forecast_archive_id)
);

CREATE INDEX idx_forecast_outcomes_evaluated ON public.forecast_outcomes (evaluated_at DESC);

ALTER TABLE public.forecast_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forecast_outcomes_read" ON public.forecast_outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "forecast_outcomes_write" ON public.forecast_outcomes FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "forecast_outcomes_update" ON public.forecast_outcomes FOR UPDATE TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 5. AGGREGATE CALIBRATION METRICS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.calibration_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version text NOT NULL REFERENCES public.model_registry(model_version),
  domain text,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  sample_size integer NOT NULL DEFAULT 0,
  window_start date,
  window_end date,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calibration_metrics_version ON public.calibration_metrics (model_version, metric_name, computed_at DESC);

ALTER TABLE public.calibration_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calibration_metrics_read" ON public.calibration_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "calibration_metrics_write" ON public.calibration_metrics FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "calibration_metrics_update" ON public.calibration_metrics FOR UPDATE TO service_role USING (true);
