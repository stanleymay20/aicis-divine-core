
-- Fix last SECURITY DEFINER view
DROP VIEW IF EXISTS action_effectiveness;
CREATE VIEW action_effectiveness
WITH (security_invoker = true)
AS
SELECT action_type, domain,
  count(*) AS times_recommended,
  count(*) FILTER (WHERE recommendation_accepted = true) AS times_accepted,
  count(*) FILTER (WHERE outcome_success = true) AS times_successful,
  round(avg(impact_score)::numeric, 1) AS avg_impact,
  round(avg(
    CASE WHEN outcome_success IS NOT NULL THEN
      CASE WHEN outcome_success THEN 1.0 ELSE 0.0 END
    ELSE NULL::numeric END) * 100, 1) AS success_rate_pct
FROM decision_outcome_log
WHERE action_type IS NOT NULL
GROUP BY action_type, domain;

-- Fix DAO stake snapshots public access
DROP POLICY IF EXISTS "Anyone can view stake snapshots" ON dao_stake_snapshots;
CREATE POLICY "Authenticated can view stake snapshots"
  ON dao_stake_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Nullify plaintext api_key in accountability_nodes (keep hash only)
UPDATE accountability_nodes SET api_key = NULL WHERE api_key IS NOT NULL;
