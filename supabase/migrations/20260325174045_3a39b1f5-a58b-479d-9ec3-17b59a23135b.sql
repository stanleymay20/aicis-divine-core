
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (action = ANY (ARRAY[
  'auth.login', 'auth.logout', 'auth.signup', 'auth.password_reset',
  'org.create', 'org.update', 'org.delete',
  'user.invite', 'user.remove', 'user.role_change',
  'data.create', 'data.update', 'data.delete', 'data.export',
  'billing.subscribe', 'billing.cancel', 'billing.payment',
  'api.key_create', 'api.key_revoke',
  'security.breach_attempt', 'security.policy_violation',
  'admin.settings_change', 'admin.backup', 'admin.restore',
  'decision.accepted', 'decision.rejected', 'decision.outcome_recorded',
  'decision.execution_started', 'decision.execution_completed',
  'engine.daily_inference', 'engine.weekly_learning', 'engine.model_promoted',
  'engine.model_rollback', 'governance.alerts_scan', 'governance.review_completed',
  'execution.owner_assigned', 'execution.started', 'execution.completed',
  'outcome.recorded', 'governance.reviewed', 'governance.postmortem_added',
  'measured_evidence_confirmed',
  'enforcement.missing_execution_owner', 'enforcement.accepted_not_started_sla',
  'enforcement.completed_no_outcome', 'enforcement.failed_no_postmortem',
  'enforcement.measured_missing_roi', 'enforcement.missing_reviewer',
  'reviewer.assigned'
]));
