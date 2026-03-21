
-- 1. Model rollback fields
ALTER TABLE decision_models 
  ADD COLUMN IF NOT EXISTS rollback_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rollback_reason text,
  ADD COLUMN IF NOT EXISTS rolled_back_from_version text,
  ADD COLUMN IF NOT EXISTS promoted_from_version text;

-- 2. Model rollback history (immutable)
CREATE TABLE IF NOT EXISTS model_rollback_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rolled_back_version text NOT NULL,
  rolled_back_to_version text NOT NULL,
  rollback_reason text NOT NULL,
  triggered_by text DEFAULT 'system',
  improvement_over_heuristic numeric,
  calibration_error numeric,
  trust_score_before numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE model_rollback_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rollback_history_select_auth" ON model_rollback_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "rollback_history_insert_admin" ON model_rollback_history FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Immutability triggers
CREATE OR REPLACE FUNCTION prevent_rollback_history_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  RAISE EXCEPTION 'model_rollback_history is immutable — UPDATE and DELETE are prohibited';
END;
$$;

CREATE TRIGGER trg_rollback_history_no_update
  BEFORE UPDATE ON model_rollback_history FOR EACH ROW
  EXECUTE FUNCTION prevent_rollback_history_mutation();

CREATE TRIGGER trg_rollback_history_no_delete
  BEFORE DELETE ON model_rollback_history FOR EACH ROW
  EXECUTE FUNCTION prevent_rollback_history_mutation();

-- 3. Execution tracking fields on decision_outcome_log
ALTER TABLE decision_outcome_log
  ADD COLUMN IF NOT EXISTS execution_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS execution_owner text,
  ADD COLUMN IF NOT EXISTS execution_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_blocker text;

-- 4. Governance discrepancies table
CREATE TABLE IF NOT EXISTS governance_discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES decision_outcome_log(id) ON DELETE CASCADE,
  discrepancy_type text NOT NULL,
  description text NOT NULL,
  detected_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text
);

ALTER TABLE governance_discrepancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discrepancies_select_auth" ON governance_discrepancies FOR SELECT TO authenticated USING (true);
CREATE POLICY "discrepancies_insert_admin" ON governance_discrepancies FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Silent failure state table
CREATE TABLE IF NOT EXISTS silent_failure_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  failure_type text NOT NULL UNIQUE,
  description text NOT NULL,
  severity text DEFAULT 'high',
  detected_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE silent_failure_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "silent_failure_select_auth" ON silent_failure_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "silent_failure_manage_admin" ON silent_failure_state FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Update execution tracking trigger
CREATE OR REPLACE FUNCTION validate_decision_outcome_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  -- Auto-set action_taken_at
  IF NEW.action_taken = true AND NEW.action_taken_at IS NULL THEN
    NEW.action_taken_at := NOW();
  END IF;
  
  -- Auto-set outcome_timestamp
  IF NEW.outcome_success IS NOT NULL AND (OLD IS NULL OR OLD.outcome_success IS NULL) AND NEW.outcome_timestamp IS NULL THEN
    NEW.outcome_timestamp := NOW();
  END IF;
  
  -- Execution tracking: action_taken=true auto-sets execution_status and started_at
  IF NEW.action_taken = true AND (OLD IS NULL OR OLD.action_taken IS DISTINCT FROM true) THEN
    IF NEW.execution_status IS NULL OR NEW.execution_status = 'not_started' THEN
      NEW.execution_status := 'in_progress';
    END IF;
    IF NEW.execution_started_at IS NULL THEN
      NEW.execution_started_at := NOW();
    END IF;
  END IF;
  
  -- Outcome submission auto-sets execution_status=completed
  IF NEW.outcome_success IS NOT NULL AND (OLD IS NULL OR OLD.outcome_success IS NULL) THEN
    NEW.execution_status := 'completed';
    IF NEW.execution_completed_at IS NULL THEN
      NEW.execution_completed_at := NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Indexes for new queries
CREATE INDEX IF NOT EXISTS idx_decision_outcome_execution_status ON decision_outcome_log(execution_status);
CREATE INDEX IF NOT EXISTS idx_silent_failure_state_resolved ON silent_failure_state(resolved, failure_type);
CREATE INDEX IF NOT EXISTS idx_governance_discrepancies_decision ON governance_discrepancies(decision_id);
CREATE INDEX IF NOT EXISTS idx_model_rollback_history_created ON model_rollback_history(created_at DESC);
