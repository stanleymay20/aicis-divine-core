
-- Fix remaining SECURITY DEFINER views

DROP VIEW IF EXISTS accountability_nodes_public;
CREATE VIEW accountability_nodes_public
WITH (security_invoker = true)
AS
SELECT id, org_name, org_type, country, jurisdiction, verified,
  joined_at, last_active_at, rate_limit_per_hour, metadata, created_at, updated_at
FROM accountability_nodes;

DROP VIEW IF EXISTS action_reliability_view;
CREATE VIEW action_reliability_view
WITH (security_invoker = true)
AS
SELECT action_type, domain,
  count(*) AS sample_size,
  count(*) FILTER (WHERE evidence_type = 'measured') AS measured_sample_size,
  count(*) FILTER (WHERE recommendation_accepted = true) AS acceptance_count,
  count(*) FILTER (WHERE outcome_success = true) AS success_count,
  CASE WHEN count(*) > 0 THEN round(count(*) FILTER (WHERE outcome_success = true)::numeric / count(*)::numeric * 100, 1) ELSE 0 END AS success_rate_pct,
  CASE WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE outcome_success = true)::numeric / count(*)::numeric + 1.96 * 1.96 / (2.0 * count(*)::numeric) - 1.96 * sqrt((count(*) FILTER (WHERE outcome_success = true)::numeric / count(*)::numeric * (1.0 - count(*) FILTER (WHERE outcome_success = true)::numeric / count(*)::numeric) + 1.96 * 1.96 / (4.0 * count(*)::numeric)) / count(*)::numeric)) / (1.0 + 1.96 * 1.96 / count(*)::numeric) * 100, 1) ELSE 0 END AS ci_lower_pct,
  CASE WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE outcome_success = true)::numeric / count(*)::numeric + 1.96 * 1.96 / (2.0 * count(*)::numeric) + 1.96 * sqrt((count(*) FILTER (WHERE outcome_success = true)::numeric / count(*)::numeric * (1.0 - count(*) FILTER (WHERE outcome_success = true)::numeric / count(*)::numeric) + 1.96 * 1.96 / (4.0 * count(*)::numeric)) / count(*)::numeric)) / (1.0 + 1.96 * 1.96 / count(*)::numeric) * 100, 1) ELSE 100 END AS ci_upper_pct,
  CASE
    WHEN count(*) >= 30 AND count(*) FILTER (WHERE evidence_type = 'measured') >= 10 THEN 'strong'
    WHEN count(*) >= 15 AND count(*) FILTER (WHERE evidence_type = 'measured') >= 5 THEN 'moderate'
    WHEN count(*) >= 5 THEN 'emerging'
    ELSE 'low'
  END AS reliability_band,
  round(avg(impact_score)::numeric, 1) AS avg_impact,
  round(avg(roi_estimate), 1) AS avg_roi
FROM decision_outcome_log
WHERE action_type IS NOT NULL
GROUP BY action_type, domain;

DROP VIEW IF EXISTS daily_accumulation;
CREATE VIEW daily_accumulation
WITH (security_invoker = true)
AS
SELECT 'snapshots'::text AS metric, snapshot_date AS day, count(*) AS count
FROM country_performance_snapshots GROUP BY snapshot_date
UNION ALL
SELECT 'forecasts'::text AS metric, date(created_at) AS day, count(*) AS count
FROM forecast_archive GROUP BY date(created_at)
UNION ALL
SELECT 'calibration'::text AS metric, date(computed_at) AS day, count(*) AS count
FROM calibration_metrics GROUP BY date(computed_at)
UNION ALL
SELECT 'vulnerability'::text AS metric, date(created_at) AS day, count(*) AS count
FROM vulnerability_scores GROUP BY date(created_at);
