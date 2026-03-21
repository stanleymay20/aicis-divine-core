
-- Add governance columns that were missing from decision_outcome_log
ALTER TABLE decision_outcome_log 
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_role TEXT,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS postmortem_note TEXT,
  ADD COLUMN IF NOT EXISTS review_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_reviewer TEXT,
  ADD COLUMN IF NOT EXISTS assigned_reviewer_role TEXT,
  ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_sla_hours INT;

-- Index for SLA overdue queries
CREATE INDEX IF NOT EXISTS idx_dol_review_due ON decision_outcome_log(review_due_at) WHERE review_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_dol_review_status ON decision_outcome_log(review_status);
