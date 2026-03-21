
-- Create immutable review history table (if not already created by prior failed migration partial)
CREATE TABLE IF NOT EXISTS decision_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decision_outcome_log(id) ON DELETE CASCADE,
  changed_by TEXT,
  changed_role TEXT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_history_decision ON decision_review_history(decision_id);
CREATE INDEX IF NOT EXISTS idx_review_history_changed_at ON decision_review_history(changed_at DESC);

ALTER TABLE decision_review_history ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist from partial migration, then recreate
DO $$ BEGIN
  DROP POLICY IF EXISTS "review_history_select" ON decision_review_history;
  DROP POLICY IF EXISTS "review_history_insert" ON decision_review_history;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "review_history_select" ON decision_review_history FOR SELECT USING (true);
CREATE POLICY "review_history_insert" ON decision_review_history FOR INSERT WITH CHECK (true);
