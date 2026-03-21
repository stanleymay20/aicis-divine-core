
-- Fix Security: restrict decision_review_history to authenticated only
DROP POLICY IF EXISTS "review_history_insert" ON decision_review_history;
DROP POLICY IF EXISTS "review_history_select" ON decision_review_history;

CREATE POLICY "review_history_insert_authenticated"
  ON decision_review_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "review_history_select_authenticated"
  ON decision_review_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "review_history_service_insert"
  ON decision_review_history FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "review_history_service_select"
  ON decision_review_history FOR SELECT
  TO service_role
  USING (true);

-- Create missing decision_metric_thresholds table
CREATE TABLE IF NOT EXISTS decision_metric_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT UNIQUE NOT NULL,
  min_samples INT NOT NULL DEFAULT 10,
  min_measured_samples INT NOT NULL DEFAULT 5,
  min_acceptances INT NOT NULL DEFAULT 3,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE decision_metric_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thresholds_select_authenticated"
  ON decision_metric_thresholds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "thresholds_service_all"
  ON decision_metric_thresholds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
