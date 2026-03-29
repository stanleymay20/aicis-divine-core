
-- Add uniqueness guard on model_evaluations
CREATE UNIQUE INDEX IF NOT EXISTS uq_model_eval_version_type 
  ON model_evaluations (model_version, evaluation_type);

-- Expand audit_log action constraint
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (action = ANY (ARRAY[
  'auth.login','auth.logout','auth.signup','auth.password_reset',
  'org.create','org.update','org.delete',
  'user.invite','user.remove','user.role_change',
  'data.create','data.update','data.delete','data.export',
  'billing.subscribe','billing.cancel','billing.payment',
  'api.key_create','api.key_revoke',
  'security.breach_attempt','security.policy_violation',
  'admin.settings_change','admin.backup','admin.restore',
  'decision.accepted','decision.rejected','decision.outcome_recorded',
  'decision.execution_started','decision.execution_completed',
  'decision_updated',
  'engine.daily_inference','engine.weekly_learning',
  'engine.model_promoted','engine.model_rollback',
  'governance.alerts_scan','governance.review_completed',
  'governance.reviewed','governance.postmortem_added',
  'execution.owner_assigned','execution.started','execution.completed',
  'execution_started','execution_completed',
  'outcome.recorded','outcome.measured',
  'outcome_recorded',
  'measured_evidence_confirmed',
  'training.measured_inserted','roi.computed',
  'enforcement.missing_execution_owner',
  'enforcement.accepted_not_started_sla',
  'enforcement.completed_no_outcome',
  'enforcement.failed_no_postmortem',
  'enforcement.measured_missing_roi',
  'enforcement.missing_reviewer',
  'reviewer.assigned'
]));
