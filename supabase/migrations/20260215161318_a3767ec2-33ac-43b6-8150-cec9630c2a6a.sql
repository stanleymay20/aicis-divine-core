
-- =====================================================
-- INSTITUTIONAL CONTROL THEORY — DB SCHEMA
-- =====================================================

-- 1. SPC control chart observations
CREATE TABLE IF NOT EXISTS public.spc_control_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'APE-V2.1',
  observed_value NUMERIC NOT NULL,
  ewma_value NUMERIC,
  rolling_mean NUMERIC,
  rolling_std NUMERIC,
  upper_control NUMERIC,
  lower_control NUMERIC,
  out_of_control BOOLEAN DEFAULT false,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spc_metric_version ON public.spc_control_observations(metric_name, model_version, observed_at DESC);

ALTER TABLE public.spc_control_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages SPC" ON public.spc_control_observations FOR ALL USING (true) WITH CHECK (true);

-- 2. Add horizon_days to forecast_residuals if not present
ALTER TABLE public.forecast_residuals ADD COLUMN IF NOT EXISTS horizon_days INTEGER DEFAULT 90;
ALTER TABLE public.forecast_residuals ADD COLUMN IF NOT EXISTS decay_weight NUMERIC DEFAULT 1.0;
ALTER TABLE public.forecast_residuals ADD COLUMN IF NOT EXISTS regime_flag TEXT DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_residuals_horizon ON public.forecast_residuals(model_version, domain, horizon_days);

-- 3. Model status lifecycle on model_registry
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_registry' AND column_name='model_status') THEN
    ALTER TABLE public.model_registry ADD COLUMN model_status TEXT NOT NULL DEFAULT 'active' CHECK (model_status IN ('shadow','challenger','active','deprecated'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_registry' AND column_name='promoted_at') THEN
    ALTER TABLE public.model_registry ADD COLUMN promoted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_registry' AND column_name='promotion_test_statistic') THEN
    ALTER TABLE public.model_registry ADD COLUMN promotion_test_statistic NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_registry' AND column_name='promotion_p_value') THEN
    ALTER TABLE public.model_registry ADD COLUMN promotion_p_value NUMERIC;
  END IF;
END $$;

-- 4. Kill-switch flag in system_flags
INSERT INTO public.system_flags (flag_key, enabled, description)
VALUES ('freeze_forecasts', false, 'Emergency kill-switch: halts all new forecast generation')
ON CONFLICT (flag_key) DO NOTHING;

INSERT INTO public.system_flags (flag_key, enabled, description)
VALUES ('spc_active', true, 'Statistical Process Control monitoring active')
ON CONFLICT (flag_key) DO NOTHING;

-- 5. Audit hash log for cryptographic verification
CREATE TABLE IF NOT EXISTS public.calibration_audit_hashes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_version TEXT NOT NULL,
  calibration_profile_id UUID,
  residual_sample_hash TEXT NOT NULL,
  residual_count INTEGER NOT NULL,
  hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_audit_hash_version ON public.calibration_audit_hashes(model_version, computed_at DESC);

ALTER TABLE public.calibration_audit_hashes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages audit hashes" ON public.calibration_audit_hashes FOR ALL USING (true) WITH CHECK (true);

-- 6. Methodology version documents
CREATE TABLE IF NOT EXISTS public.methodology_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_version TEXT NOT NULL,
  document_version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hash TEXT,
  UNIQUE(model_version, document_version)
);

ALTER TABLE public.methodology_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read methodology" ON public.methodology_documents FOR SELECT USING (true);
CREATE POLICY "Service role writes methodology" ON public.methodology_documents FOR INSERT WITH CHECK (true);
