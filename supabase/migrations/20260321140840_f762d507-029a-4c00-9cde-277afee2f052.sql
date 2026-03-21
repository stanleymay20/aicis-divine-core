
ALTER TABLE decision_outcome_log
  ADD COLUMN IF NOT EXISTS cost_of_action numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roi_estimate numeric,
  ADD COLUMN IF NOT EXISTS net_value numeric;

ALTER TABLE model_evaluations
  ADD COLUMN IF NOT EXISTS heuristic_success_rate numeric,
  ADD COLUMN IF NOT EXISTS improvement_over_previous numeric,
  ADD COLUMN IF NOT EXISTS improvement_over_heuristic numeric,
  ADD COLUMN IF NOT EXISTS avg_roi numeric,
  ADD COLUMN IF NOT EXISTS total_net_value numeric;

CREATE OR REPLACE VIEW action_effectiveness_leaderboard AS
SELECT
  action_type,
  COUNT(*)::int AS times_recommended,
  COUNT(*) FILTER (WHERE recommendation_accepted = true)::int AS times_accepted,
  COUNT(*) FILTER (WHERE outcome_success = true)::int AS times_successful,
  ROUND(AVG(impact_score)::numeric, 1) AS avg_impact,
  ROUND(AVG(roi_estimate)::numeric, 1) AS avg_roi,
  ROUND(
    CASE WHEN COUNT(*) FILTER (WHERE outcome_success IS NOT NULL) > 0
    THEN (COUNT(*) FILTER (WHERE outcome_success = true)::numeric / COUNT(*) FILTER (WHERE outcome_success IS NOT NULL)::numeric * 100)
    ELSE NULL END::numeric, 1
  ) AS success_rate_pct,
  COUNT(DISTINCT domain)::int AS domain_count
FROM decision_outcome_log
WHERE action_type IS NOT NULL
GROUP BY action_type
ORDER BY times_successful DESC;

CREATE OR REPLACE VIEW system_trust_score AS
SELECT
  me.model_version,
  me.calibration_error::numeric AS calibration_error,
  me.acceptance_rate::numeric AS acceptance_rate,
  dm.outcome_maturity_ratio::numeric AS outcome_maturity_ratio,
  ROUND((
    COALESCE((1.0 - LEAST(me.calibration_error::numeric, 1.0::numeric)), 0.5::numeric) * 0.4 +
    COALESCE(me.acceptance_rate::numeric, 0.5::numeric) * 0.3 +
    COALESCE(dm.outcome_maturity_ratio::numeric, 0::numeric) * 0.3
  ) * 100, 0)::numeric AS trust_score,
  me.evaluated_at
FROM model_evaluations me
LEFT JOIN decision_models dm ON dm.version = me.model_version AND dm.status = 'active'
ORDER BY me.evaluated_at DESC
LIMIT 1;
