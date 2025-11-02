-- Create diagnostics log table
CREATE TABLE IF NOT EXISTS diagnostics_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  missing_env text[],
  failed_apis jsonb,
  failed_tables text[],
  latency_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostics_time ON diagnostics_log(created_at DESC);

ALTER TABLE diagnostics_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_diagnostics_admin ON diagnostics_log FOR SELECT 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY write_diagnostics_sys ON diagnostics_log FOR INSERT WITH CHECK (true);