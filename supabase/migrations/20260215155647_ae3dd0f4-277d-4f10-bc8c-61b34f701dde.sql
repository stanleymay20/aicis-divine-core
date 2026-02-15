
-- 1. Add train/test isolation fields to forecast_archive
ALTER TABLE public.forecast_archive
  ADD COLUMN IF NOT EXISTS training_window_end text,
  ADD COLUMN IF NOT EXISTS calibration_version text,
  ADD COLUMN IF NOT EXISTS parameter_set_id text;

-- 2. Add calibration function storage to calibration_metrics
ALTER TABLE public.calibration_metrics
  ADD COLUMN IF NOT EXISTS calibration_params jsonb;

-- 3. Forecast job queue for background processing
CREATE TABLE IF NOT EXISTS public.forecast_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso3 text NOT NULL,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  model_version text NOT NULL DEFAULT 'APE-V2.1',
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  idempotency_key text UNIQUE
);

ALTER TABLE public.forecast_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forecast_jobs_read_auth" ON public.forecast_jobs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "forecast_jobs_write_service" ON public.forecast_jobs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "forecast_jobs_update_service" ON public.forecast_jobs
  FOR UPDATE TO service_role USING (true);

CREATE INDEX idx_forecast_jobs_status ON public.forecast_jobs (status, priority DESC, created_at);
CREATE INDEX idx_forecast_jobs_idempotency ON public.forecast_jobs (idempotency_key);

-- 4. Cross-domain dependency matrix for fragility propagation
CREATE TABLE IF NOT EXISTS public.domain_coupling_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_domain text NOT NULL,
  target_domain text NOT NULL,
  coupling_weight numeric NOT NULL DEFAULT 0.1,
  propagation_delay_days integer DEFAULT 30,
  model_version text NOT NULL DEFAULT 'APE-V2.1',
  evidence_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_domain, target_domain, model_version)
);

ALTER TABLE public.domain_coupling_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupling_read_auth" ON public.domain_coupling_matrix
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "coupling_write_service" ON public.domain_coupling_matrix
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed initial coupling matrix
INSERT INTO public.domain_coupling_matrix (source_domain, target_domain, coupling_weight, propagation_delay_days, evidence_note) VALUES
  ('energy', 'food', 0.35, 30, 'Energy price shocks propagate to food production costs'),
  ('energy', 'finance', 0.25, 15, 'Energy costs affect industrial output and inflation'),
  ('security', 'governance', 0.40, 7, 'Conflict destabilizes governance institutions'),
  ('security', 'finance', 0.30, 14, 'Security events trigger capital flight'),
  ('governance', 'health', 0.30, 60, 'Governance quality affects health system capacity'),
  ('governance', 'finance', 0.25, 30, 'Institutional quality affects investor confidence'),
  ('health', 'finance', 0.20, 45, 'Health crises reduce workforce productivity'),
  ('food', 'health', 0.25, 30, 'Food insecurity causes malnutrition and disease'),
  ('finance', 'governance', 0.20, 60, 'Economic crisis erodes governance legitimacy'),
  ('food', 'security', 0.30, 45, 'Food crises trigger social unrest')
ON CONFLICT DO NOTHING;

-- 5. Partial indexes for forecast_archive scalability
CREATE INDEX IF NOT EXISTS idx_forecast_archive_created_month
  ON public.forecast_archive (created_at)
  WHERE created_at >= '2026-01-01';

CREATE INDEX IF NOT EXISTS idx_forecast_archive_iso3_domain
  ON public.forecast_archive (iso3, domain);

CREATE INDEX IF NOT EXISTS idx_forecast_archive_model
  ON public.forecast_archive (model_version);

-- 6. Forecast outcomes index
CREATE INDEX IF NOT EXISTS idx_forecast_outcomes_archive
  ON public.forecast_outcomes (forecast_archive_id);
