-- Create satellite observations table
CREATE TABLE IF NOT EXISTS satellite_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code text,
  lat double precision,
  lon double precision,
  timestamp timestamptz,
  source text NOT NULL,
  layer text NOT NULL,
  value numeric,
  confidence numeric,
  related_event uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sat_obs_time ON satellite_observations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sat_obs_iso ON satellite_observations(iso_code);
CREATE INDEX IF NOT EXISTS idx_sat_obs_source ON satellite_observations(source);

ALTER TABLE satellite_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_sat_obs ON satellite_observations FOR SELECT USING (true);
CREATE POLICY write_sat_obs_sys ON satellite_observations FOR INSERT WITH CHECK (true);

-- Create system errors table
CREATE TABLE IF NOT EXISTS system_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sys_errors_time ON system_errors(created_at DESC);

ALTER TABLE system_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_sys_errors_admin ON system_errors FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY write_sys_errors ON system_errors FOR INSERT WITH CHECK (true);

-- Create predicted scores table
CREATE TABLE IF NOT EXISTS predicted_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code text NOT NULL,
  division text NOT NULL,
  predicted_date date NOT NULL,
  risk_score numeric NOT NULL,
  confidence numeric,
  model_version text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pred_scores_date ON predicted_scores(predicted_date DESC);
CREATE INDEX IF NOT EXISTS idx_pred_scores_iso ON predicted_scores(iso_code);

ALTER TABLE predicted_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_pred_scores ON predicted_scores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY write_pred_scores_sys ON predicted_scores FOR INSERT WITH CHECK (true);

-- Create ethics audit log table
CREATE TABLE IF NOT EXISTS ethics_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  country text,
  bias_index numeric,
  assessment text,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ethics_time ON ethics_audit_log(created_at DESC);

ALTER TABLE ethics_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_ethics_admin ON ethics_audit_log FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));
CREATE POLICY write_ethics ON ethics_audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);