
CREATE OR REPLACE VIEW public.action_reliability_view AS
SELECT
  action_type,
  domain,
  COUNT(*) AS sample_size,
  COUNT(*) FILTER (WHERE evidence_type = 'measured') AS measured_sample_size,
  COUNT(*) FILTER (WHERE recommendation_accepted = true) AS acceptance_count,
  COUNT(*) FILTER (WHERE outcome_success = true) AS success_count,
  CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE outcome_success = true)::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END AS success_rate_pct,
  CASE WHEN COUNT(*) > 0 THEN ROUND(
    (
      (COUNT(*) FILTER (WHERE outcome_success = true)::numeric / COUNT(*)::numeric + 1.96*1.96 / (2.0*COUNT(*)::numeric)
       - 1.96 * SQRT(
         (COUNT(*) FILTER (WHERE outcome_success = true)::numeric / COUNT(*)::numeric * (1.0 - COUNT(*) FILTER (WHERE outcome_success = true)::numeric / COUNT(*)::numeric) + 1.96*1.96 / (4.0*COUNT(*)::numeric)) / COUNT(*)::numeric
       )) / (1.0 + 1.96*1.96 / COUNT(*)::numeric)
    ) * 100, 1)
  ELSE 0 END AS ci_lower_pct,
  CASE WHEN COUNT(*) > 0 THEN ROUND(
    (
      (COUNT(*) FILTER (WHERE outcome_success = true)::numeric / COUNT(*)::numeric + 1.96*1.96 / (2.0*COUNT(*)::numeric)
       + 1.96 * SQRT(
         (COUNT(*) FILTER (WHERE outcome_success = true)::numeric / COUNT(*)::numeric * (1.0 - COUNT(*) FILTER (WHERE outcome_success = true)::numeric / COUNT(*)::numeric) + 1.96*1.96 / (4.0*COUNT(*)::numeric)) / COUNT(*)::numeric
       )) / (1.0 + 1.96*1.96 / COUNT(*)::numeric)
    ) * 100, 1)
  ELSE 100 END AS ci_upper_pct,
  CASE
    WHEN COUNT(*) >= 30 AND COUNT(*) FILTER (WHERE evidence_type = 'measured') >= 10 THEN 'strong'
    WHEN COUNT(*) >= 15 AND COUNT(*) FILTER (WHERE evidence_type = 'measured') >= 5 THEN 'moderate'
    WHEN COUNT(*) >= 5 THEN 'emerging'
    ELSE 'low'
  END AS reliability_band,
  ROUND(AVG(impact_score)::numeric, 1) AS avg_impact,
  ROUND(AVG(roi_estimate)::numeric, 1) AS avg_roi
FROM public.decision_outcome_log
WHERE action_type IS NOT NULL
GROUP BY action_type, domain;
