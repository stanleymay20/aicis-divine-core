-- 1. Add missing guardrail_flags column to decision_inference_audit
ALTER TABLE decision_inference_audit
ADD COLUMN IF NOT EXISTS guardrail_flags jsonb DEFAULT '[]'::jsonb;

-- 2. Tighten decision_review_history INSERT: only admin or service_role
DROP POLICY IF EXISTS "review_history_insert_authenticated" ON decision_review_history;
CREATE POLICY "review_history_insert_admin"
ON decision_review_history FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Add measured_count column to model_evaluations if missing
ALTER TABLE model_evaluations
ADD COLUMN IF NOT EXISTS measured_count integer DEFAULT 0;

-- 4. Create indexes for faster governance queries
CREATE INDEX IF NOT EXISTS idx_outcome_log_review_status ON decision_outcome_log(review_status);
CREATE INDEX IF NOT EXISTS idx_outcome_log_assigned_reviewer ON decision_outcome_log(assigned_reviewer);
CREATE INDEX IF NOT EXISTS idx_outcome_log_review_due ON decision_outcome_log(review_due_at);
CREATE INDEX IF NOT EXISTS idx_review_history_decision_id ON decision_review_history(decision_id);
CREATE INDEX IF NOT EXISTS idx_inference_audit_model ON decision_inference_audit(model_version);
CREATE INDEX IF NOT EXISTS idx_training_dataset_domain ON decision_training_dataset(domain);
CREATE INDEX IF NOT EXISTS idx_training_dataset_label ON decision_training_dataset(label_source);