-- 1. Add missing fields to decision_outcome_log
ALTER TABLE decision_outcome_log 
  ADD COLUMN IF NOT EXISTS outcome_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS execution_note text;

-- 2. Add promotion guardrails to decision_models
ALTER TABLE decision_models
  ADD COLUMN IF NOT EXISTS promotion_status text DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 3. Validation trigger: auto-set timestamps on decision outcomes
CREATE OR REPLACE FUNCTION public.validate_decision_outcome_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.action_taken = true AND NEW.action_taken_at IS NULL THEN
    NEW.action_taken_at := NOW();
  END IF;
  
  IF NEW.outcome_success IS NOT NULL AND (OLD IS NULL OR OLD.outcome_success IS NULL) AND NEW.outcome_timestamp IS NULL THEN
    NEW.outcome_timestamp := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_decision_outcome ON decision_outcome_log;
CREATE TRIGGER trg_validate_decision_outcome
  BEFORE INSERT OR UPDATE ON decision_outcome_log
  FOR EACH ROW
  EXECUTE FUNCTION validate_decision_outcome_log();

-- 4. Model promotion guardrail trigger
CREATE OR REPLACE FUNCTION public.validate_model_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_eval RECORD;
  v_prev_eval RECORD;
BEGIN
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT * INTO v_eval FROM model_evaluations 
      WHERE model_version = NEW.version 
      ORDER BY evaluated_at DESC LIMIT 1;
    
    IF v_eval IS NOT NULL THEN
      IF v_eval.improvement_over_heuristic IS NOT NULL AND v_eval.improvement_over_heuristic < -5 THEN
        NEW.promotion_status := 'rejected';
        NEW.rejection_reason := 'Underperforms heuristic by ' || ROUND(ABS(v_eval.improvement_over_heuristic)::numeric, 1) || '%';
        NEW.status := 'rejected';
      END IF;
      
      SELECT * INTO v_prev_eval FROM model_evaluations
        WHERE model_version != NEW.version AND calibration_error IS NOT NULL
        ORDER BY evaluated_at DESC LIMIT 1;
      
      IF v_prev_eval IS NOT NULL AND v_eval.calibration_error IS NOT NULL 
         AND v_prev_eval.calibration_error IS NOT NULL
         AND v_eval.calibration_error > v_prev_eval.calibration_error * 1.5 THEN
        NEW.promotion_status := 'rejected';
        NEW.rejection_reason := 'Calibration regression: ' || ROUND(v_eval.calibration_error::numeric, 3) || ' vs ' || ROUND(v_prev_eval.calibration_error::numeric, 3);
        NEW.status := 'rejected';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_model_promotion ON decision_models;
CREATE TRIGGER trg_validate_model_promotion
  BEFORE INSERT OR UPDATE ON decision_models
  FOR EACH ROW
  EXECUTE FUNCTION validate_model_promotion();