
CREATE OR REPLACE VIEW public.domain_evidence_summary
WITH (security_invoker = true)
AS
SELECT
  d.domain,
  COUNT(*) AS total_decisions,
  COUNT(*) FILTER (WHERE d.recommendation_accepted = true) AS accepted_count,
  COUNT(*) FILTER (WHERE d.action_taken = true) AS executed_count,
  COUNT(*) FILTER (WHERE d.execution_status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE d.evidence_type = 'measured') AS measured_count,
  COUNT(*) FILTER (WHERE d.evidence_type = 'measured' AND d.outcome_timestamp >= now() - interval '7 days') AS measured_7d,
  ROUND(COALESCE(AVG(d.roi_estimate) FILTER (WHERE d.roi_estimate IS NOT NULL), 0)::numeric, 2) AS avg_roi,
  CASE 
    WHEN COUNT(*) FILTER (WHERE d.outcome_success = false) > 0 
    THEN ROUND(COUNT(*) FILTER (WHERE d.outcome_success = false AND d.postmortem_note IS NOT NULL)::numeric / NULLIF(COUNT(*) FILTER (WHERE d.outcome_success = false), 0) * 100, 0)
    ELSE 100
  END AS postmortem_rate,
  (SELECT COUNT(*) FROM audit_log al WHERE al.resource_id IN (SELECT dol.signal_id FROM decision_outcome_log dol WHERE dol.domain = d.domain)) AS audit_event_count,
  (SELECT COUNT(*) FROM silent_failure_state sf WHERE sf.resolved_at IS NULL AND sf.failure_type ILIKE '%' || d.domain || '%') AS active_failure_count
FROM decision_outcome_log d
GROUP BY d.domain;
