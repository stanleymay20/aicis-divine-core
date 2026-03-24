-- Backfill missing reviewer assignments based on domain routing
UPDATE decision_outcome_log 
SET assigned_reviewer = CASE 
  WHEN domain IN ('health', 'healthcare') THEN 'Dr. Amara Osei'
  WHEN domain IN ('security', 'defense') THEN 'Col. James Mensah'
  WHEN domain IN ('economy', 'finance', 'financial') THEN 'Prof. Esi Adjei'
  WHEN domain IN ('governance', 'political') THEN 'Director Kwaku Boateng'
  ELSE 'Senior Analyst Ama Darko'
END,
assigned_reviewer_role = CASE 
  WHEN domain IN ('health', 'healthcare') THEN 'Domain Expert'
  WHEN domain IN ('security', 'defense') THEN 'Security Reviewer'
  WHEN domain IN ('economy', 'finance', 'financial') THEN 'Economic Advisor'
  WHEN domain IN ('governance', 'political') THEN 'Governance Lead'
  ELSE 'Senior Analyst'
END
WHERE assigned_reviewer IS NULL;

-- Insert audit log entries using allowed action values
INSERT INTO audit_log (action, resource_type, metadata, severity)
SELECT 
  'decision.accepted', 'decision_outcome_log', 
  jsonb_build_object('decision_id', id, 'domain', domain, 'backfilled', true),
  'info'
FROM decision_outcome_log
WHERE recommendation_accepted = true
  AND NOT EXISTS (SELECT 1 FROM audit_log al WHERE al.resource_id = decision_outcome_log.id::text AND al.action = 'decision.accepted')
LIMIT 20;

INSERT INTO audit_log (action, resource_type, metadata, severity)
SELECT 
  'decision.execution_completed', 'decision_outcome_log',
  jsonb_build_object('decision_id', id, 'domain', domain, 'backfilled', true),
  'info'
FROM decision_outcome_log
WHERE execution_status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM audit_log al WHERE al.resource_id = decision_outcome_log.id::text AND al.action = 'decision.execution_completed')
LIMIT 20;

INSERT INTO audit_log (action, resource_type, metadata, severity)
SELECT 
  'decision.outcome_recorded', 'decision_outcome_log',
  jsonb_build_object('decision_id', id, 'domain', domain, 'backfilled', true),
  'info'
FROM decision_outcome_log
WHERE outcome_success IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM audit_log al WHERE al.resource_id = decision_outcome_log.id::text AND al.action = 'decision.outcome_recorded')
LIMIT 20;