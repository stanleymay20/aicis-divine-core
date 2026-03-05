-- Prediction Validation Layer (read-only w.r.t. forecast engine)

-- Table 1: Multi-horizon forecast validation results
CREATE TABLE public.forecast_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_archive_id uuid REFERENCES public.forecast_archive(id),
  iso3 text NOT NULL,
  domain text NOT NULL,
  forecast_date date NOT NULL,
  realized_date date NOT NULL,
  horizon_days integer NOT NULL,
  predicted_value numeric,
  actual_value numeric,
  absolute_error numeric,
  percentage_error numeric,
  predicted_direction text,
  actual_direction text,
  direction_hit boolean,
  confidence_at_forecast numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_fvr_horizon ON public.forecast_validation_results(horizon_days);
CREATE INDEX idx_fvr_iso3_domain ON public.forecast_validation_results(iso3, domain);
CREATE INDEX idx_fvr_created ON public.forecast_validation_results(created_at DESC);
CREATE INDEX idx_fvr_forecast_date ON public.forecast_validation_results(forecast_date DESC);

-- Table 2: Vulnerability-event correlations
CREATE TABLE public.vulnerability_event_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso3 text NOT NULL,
  country text NOT NULL,
  vulnerability_score numeric NOT NULL,
  vulnerability_date date NOT NULL,
  event_type text NOT NULL,
  event_id uuid,
  event_date date NOT NULL,
  days_between integer NOT NULL,
  signal_strength numeric,
  event_severity numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vec_iso3 ON public.vulnerability_event_correlations(iso3);
CREATE INDEX idx_vec_days ON public.vulnerability_event_correlations(days_between);
CREATE INDEX idx_vec_created ON public.vulnerability_event_correlations(created_at DESC);

-- RLS
ALTER TABLE public.forecast_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerability_event_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read validation results"
  ON public.forecast_validation_results FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role inserts validation results"
  ON public.forecast_validation_results FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read vulnerability correlations"
  ON public.vulnerability_event_correlations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role inserts vulnerability correlations"
  ON public.vulnerability_event_correlations FOR INSERT TO service_role
  WITH CHECK (true);