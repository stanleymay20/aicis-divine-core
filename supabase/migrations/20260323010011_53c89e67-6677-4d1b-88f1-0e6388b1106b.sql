-- 1. Create daily_system_health table
CREATE TABLE IF NOT EXISTS public.daily_system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_date date NOT NULL DEFAULT CURRENT_DATE,
  inferences_generated int DEFAULT 0,
  decisions_captured int DEFAULT 0,
  executions_started int DEFAULT 0,
  outcomes_recorded int DEFAULT 0,
  measured_outcomes int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(health_date)
);
ALTER TABLE public.daily_system_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read daily_system_health" ON public.daily_system_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service insert daily_system_health" ON public.daily_system_health FOR INSERT TO authenticated WITH CHECK (true);

-- 2. Upgrade system_trust_score view to use real metrics from decision_outcome_log
DROP VIEW IF EXISTS public.system_trust_score;
CREATE VIEW public.system_trust_score WITH (security_invoker = true) AS
WITH stats AS (
  SELECT
    count(*) FILTER (WHERE execution_status = 'completed') AS completed_count,
    count(*) FILTER (WHERE evidence_type = 'measured') AS measured_count,
    count(*) FILTER (WHERE recommendation_accepted = true) AS accepted_count,
    count(*) AS total_count,
    count(*) FILTER (WHERE recommendation_accepted = true AND execution_status IS NOT NULL AND execution_status != 'not_started') AS exec_started_count,
    count(*) FILTER (WHERE review_status = 'approved' OR review_status = 'overridden') AS reviewed_count,
    count(*) FILTER (WHERE outcome_success = false AND recommendation_accepted = true AND postmortem_note IS NOT NULL) AS pm_done_count,
    count(*) FILTER (WHERE outcome_success = false AND recommendation_accepted = true) AS pm_needed_count
  FROM decision_outcome_log
),
model AS (
  SELECT me.model_version, me.calibration_error, me.evaluated_at
  FROM model_evaluations me
  JOIN decision_models dm ON dm.version = me.model_version AND dm.status = 'active'
  ORDER BY me.evaluated_at DESC
  LIMIT 1
)
SELECT
  COALESCE(m.model_version, 'none') AS model_version,
  m.calibration_error,
  CASE WHEN s.total_count > 0 THEN ROUND(s.accepted_count::numeric / s.total_count, 3) ELSE 0 END AS acceptance_rate,
  CASE WHEN s.completed_count > 0 THEN ROUND(s.measured_count::numeric / s.completed_count, 3) ELSE 0 END AS outcome_maturity_ratio,
  ROUND(GREATEST(0, LEAST(100,
    (COALESCE(1.0 - LEAST(m.calibration_error, 1.0), 0.5) * 0.25 +
     CASE WHEN s.total_count > 0 THEN s.accepted_count::numeric / s.total_count ELSE 0.5 END * 0.20 +
     CASE WHEN s.completed_count > 0 THEN s.measured_count::numeric / s.completed_count ELSE 0 END * 0.25 +
     CASE WHEN s.accepted_count > 0 THEN s.exec_started_count::numeric / s.accepted_count ELSE 0 END * 0.15 +
     CASE WHEN s.total_count > 0 THEN s.reviewed_count::numeric / s.total_count ELSE 0 END * 0.10 +
     CASE WHEN s.pm_needed_count > 0 THEN s.pm_done_count::numeric / s.pm_needed_count ELSE 1.0 END * 0.05
    ) * 100
  )), 0) AS trust_score,
  COALESCE(m.evaluated_at, now()) AS evaluated_at
FROM stats s
CROSS JOIN (SELECT * FROM model UNION ALL SELECT 'none', null, now() LIMIT 1) m;

-- 3. Add RLS to governance_discrepancies if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'governance_discrepancies' AND policyname = 'Auth read governance_discrepancies') THEN
    CREATE POLICY "Auth read governance_discrepancies" ON public.governance_discrepancies FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'governance_discrepancies' AND policyname = 'Auth insert governance_discrepancies') THEN
    CREATE POLICY "Auth insert governance_discrepancies" ON public.governance_discrepancies FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 4. Add RLS to silent_failure_state if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'silent_failure_state' AND policyname = 'Auth read silent_failure_state') THEN
    CREATE POLICY "Auth read silent_failure_state" ON public.silent_failure_state FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 5. Add RLS to weekly_learning_logs if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_learning_logs' AND policyname = 'Auth read weekly_learning_logs') THEN
    CREATE POLICY "Auth read weekly_learning_logs" ON public.weekly_learning_logs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 6. Ensure audit_log has insert policy for authenticated
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'Auth insert audit_log') THEN
    CREATE POLICY "Auth insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'Auth read audit_log') THEN
    CREATE POLICY "Auth read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);
  END IF;
END $$;