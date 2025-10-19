-- Create system_config table for dynamic configuration
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create data_source_log for tracking data ingestion health
CREATE TABLE IF NOT EXISTS data_source_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  division TEXT NOT NULL,
  source TEXT NOT NULL,
  records_ingested INT NOT NULL DEFAULT 0,
  latency_ms FLOAT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
  error_message TEXT,
  last_success TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for system_config
CREATE POLICY "Config readable by authenticated users"
  ON system_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Config writable by admins"
  ON system_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for data_source_log
CREATE POLICY "Data logs readable by authenticated users"
  ON data_source_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Data logs writable by system"
  ON data_source_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Seed system_config with defaults
INSERT INTO system_config (key, value, description) VALUES
  ('EMA_ALPHA', '{"default": 0.3}'::jsonb, 'Exponential moving average smoothing factor'),
  ('NODE_RELIABILITY', '{"default": 0.92}'::jsonb, 'Default federation node reliability score'),
  ('ENERGY_THRESHOLD', '{"default": 85}'::jsonb, 'Energy stability threshold percentage'),
  ('DATA_REFRESH_INTERVAL_HOURS', '{"default": 6}'::jsonb, 'Hours between automatic data refreshes'),
  ('ALERT_LATENCY_THRESHOLD_SEC', '{"default": 30}'::jsonb, 'Maximum acceptable API latency in seconds'),
  ('FINANCE_REFRESH_HOURS', '{"default": 1}'::jsonb, 'Hours between finance data refreshes'),
  ('HEALTH_REFRESH_HOURS', '{"default": 24}'::jsonb, 'Hours between health data refreshes'),
  ('ENERGY_REFRESH_HOURS', '{"default": 24}'::jsonb, 'Hours between energy data refreshes'),
  ('FOOD_REFRESH_HOURS', '{"default": 168}'::jsonb, 'Hours between food security data refreshes (weekly)')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_data_source_log_division ON data_source_log(division);
CREATE INDEX idx_data_source_log_status ON data_source_log(status);
CREATE INDEX idx_data_source_log_created ON data_source_log(created_at DESC);