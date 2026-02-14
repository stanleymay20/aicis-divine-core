
-- ============================================================
-- PHASE 3: Infrastructure Hardening
-- ============================================================

-- 1. Feature flags table
CREATE TABLE IF NOT EXISTS public.system_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Flags readable by authenticated" ON public.system_flags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can modify flags" ON public.system_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default flags
INSERT INTO public.system_flags (flag_key, enabled, description) VALUES
  ('use_v2_engine', true, 'Use Performance Engine V2 (Holt-based) instead of V1'),
  ('enable_structural_break_detection', true, 'Enable CUSUM structural break detection'),
  ('enable_fragility_model', true, 'Enable nonlinear systemic fragility multiplier'),
  ('enable_momentum_significance', true, 'Filter momentum by t-statistic significance'),
  ('enable_data_gap_interpolation', true, 'Interpolate missing data periods')
ON CONFLICT (flag_key) DO NOTHING;

-- 2. Domain model parameters table (calibrated α/β per domain per country)
CREATE TABLE IF NOT EXISTS public.domain_model_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso3 text NOT NULL,
  domain text NOT NULL,
  alpha numeric NOT NULL DEFAULT 0.55,
  beta numeric NOT NULL DEFAULT 0.3,
  calibrated_rmse numeric,
  calibrated_at timestamptz DEFAULT now(),
  UNIQUE (iso3, domain)
);

ALTER TABLE public.domain_model_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parameters readable by authenticated" ON public.domain_model_parameters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can modify parameters" ON public.domain_model_parameters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_model_params_iso3_domain
  ON public.domain_model_parameters (iso3, domain);

-- 3. Add MAPE and forecast_bias to performance_backtests
ALTER TABLE public.performance_backtests
  ADD COLUMN IF NOT EXISTS mape numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forecast_bias numeric DEFAULT 0;

-- 4. Partial indexes for hot queries
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged
  ON public.alerts (created_at DESC)
  WHERE acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_crisis_events_active
  ON public.crisis_events (severity DESC, created_at DESC)
  WHERE status = 'active';

-- 5. Add data gap tracking to snapshots
ALTER TABLE public.country_performance_snapshots
  ADD COLUMN IF NOT EXISTS data_gap_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_stale_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_t_stat numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_p_value numeric DEFAULT 1;
