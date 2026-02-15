
-- 1. Model Calibration Profiles (locked per version)
CREATE TABLE public.model_calibration_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_version TEXT NOT NULL REFERENCES model_registry(model_version),
  platt_a DOUBLE PRECISION NOT NULL DEFAULT -1,
  platt_b DOUBLE PRECISION NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  fitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_calibration_profile_version ON model_calibration_profiles(model_version) WHERE status = 'active';
ALTER TABLE model_calibration_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read calibration profiles" ON model_calibration_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage calibration profiles" ON model_calibration_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Forecast Residual Distribution (empirical error modeling)
CREATE TABLE public.forecast_residuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_version TEXT NOT NULL,
  domain TEXT NOT NULL,
  iso3 TEXT,
  residual DOUBLE PRECISION NOT NULL,
  predicted_value DOUBLE PRECISION NOT NULL,
  realized_value DOUBLE PRECISION NOT NULL,
  horizon_days INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_residuals_version_domain ON forecast_residuals(model_version, domain);
CREATE INDEX idx_residuals_created ON forecast_residuals(created_at DESC);
ALTER TABLE forecast_residuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read residuals" ON forecast_residuals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage residuals" ON forecast_residuals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Drift Alerts table
CREATE TABLE public.drift_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL, -- 'rmse_spike', 'calibration_divergence', 'confidence_inflation', 'break_frequency'
  model_version TEXT NOT NULL,
  metric_name TEXT,
  current_value DOUBLE PRECISION,
  baseline_value DOUBLE PRECISION,
  deviation_pct DOUBLE PRECISION,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_drift_alerts_type ON drift_alerts(alert_type, created_at DESC);
CREATE INDEX idx_drift_alerts_unack ON drift_alerts(acknowledged, created_at DESC) WHERE acknowledged = false;
ALTER TABLE drift_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read drift alerts" ON drift_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated ack drift alerts" ON drift_alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage drift alerts" ON drift_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Operational Telemetry
CREATE TABLE public.operational_telemetry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  execution_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  items_processed INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_telemetry_function ON operational_telemetry(function_name, created_at DESC);
CREATE INDEX idx_telemetry_status ON operational_telemetry(status, created_at DESC);
ALTER TABLE operational_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read telemetry" ON operational_telemetry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manage telemetry" ON operational_telemetry FOR ALL TO service_role USING (true) WITH CHECK (true);
