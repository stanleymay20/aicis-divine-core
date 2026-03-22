-- Attach the existing trigger function to the table
CREATE TRIGGER trg_validate_decision_outcome_log
  BEFORE INSERT OR UPDATE ON decision_outcome_log
  FOR EACH ROW
  EXECUTE FUNCTION validate_decision_outcome_log();

-- Backfill execution_status for records that have outcomes
UPDATE decision_outcome_log
SET execution_status = 'completed',
    execution_completed_at = COALESCE(outcome_timestamp, updated_at, NOW()),
    execution_started_at = COALESCE(action_taken_at, created_at)
WHERE outcome_success IS NOT NULL
  AND execution_status = 'not_started';

-- Backfill records that have action_taken but no outcome  
UPDATE decision_outcome_log
SET execution_status = 'in_progress',
    execution_started_at = COALESCE(action_taken_at, NOW())
WHERE action_taken = true
  AND outcome_success IS NULL
  AND execution_status = 'not_started';