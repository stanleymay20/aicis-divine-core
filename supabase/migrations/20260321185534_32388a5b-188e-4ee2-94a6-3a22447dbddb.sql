
-- Fix SECURITY DEFINER views by converting to SECURITY INVOKER
-- This ensures views respect the querying user's RLS policies

-- Recreate organizations_member_view with SECURITY INVOKER
DROP VIEW IF EXISTS organizations_member_view;
CREATE VIEW organizations_member_view
WITH (security_invoker = true)
AS
SELECT id, name, owner_id, tier, status, feature_flags,
  billing_status, trial_ends_at, created_at, updated_at,
  api_enabled, max_api_keys, monthly_api_quota, white_label_enabled
FROM organizations;

-- Recreate organizations_safe_view with SECURITY INVOKER
DROP VIEW IF EXISTS organizations_safe_view;
CREATE VIEW organizations_safe_view
WITH (security_invoker = true)
AS
SELECT id, name, owner_id, tier, status, feature_flags,
  billing_status, trial_ends_at, cancel_at_period_end,
  created_at, updated_at, api_enabled, max_api_keys,
  monthly_api_quota, white_label_enabled
FROM organizations;

-- Recreate system_trust_score with SECURITY INVOKER
DROP VIEW IF EXISTS system_trust_score;
CREATE VIEW system_trust_score
WITH (security_invoker = true)
AS
SELECT me.model_version,
  me.calibration_error,
  me.acceptance_rate,
  (dm.outcome_maturity_ratio)::numeric AS outcome_maturity_ratio,
  round(((((COALESCE((1.0 - LEAST(me.calibration_error, 1.0)), 0.5) * 0.4) + (COALESCE(me.acceptance_rate, 0.5) * 0.3)) + (COALESCE((dm.outcome_maturity_ratio)::numeric, (0)::numeric) * 0.3)) * (100)::numeric), 0) AS trust_score,
  me.evaluated_at
FROM (model_evaluations me
  LEFT JOIN decision_models dm ON (((dm.version = me.model_version) AND (dm.status = 'active'::text))))
ORDER BY me.evaluated_at DESC
LIMIT 1;
