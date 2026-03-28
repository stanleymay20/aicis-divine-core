
-- Security hardening: Remove overly permissive RLS policies
DROP POLICY IF EXISTS "Auth read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can read billing_events" ON public.billing_events;

-- Restrict system_config to admin roles only
DROP POLICY IF EXISTS "Authenticated can read system_config" ON public.system_config;
CREATE POLICY "Admins can read system_config"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tighten calibration_metrics UPDATE to admin only
DROP POLICY IF EXISTS "calibration_metrics_update" ON public.calibration_metrics;
CREATE POLICY "calibration_metrics_update"
  ON public.calibration_metrics FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tighten drift_alerts UPDATE to admin/operator
DROP POLICY IF EXISTS "Authenticated ack drift alerts" ON public.drift_alerts;
CREATE POLICY "Operators can ack drift alerts"
  ON public.drift_alerts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- Performance indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_decision_outcome_log_execution_status 
  ON public.decision_outcome_log(execution_status);
CREATE INDEX IF NOT EXISTS idx_decision_outcome_log_evidence_type 
  ON public.decision_outcome_log(evidence_type);
CREATE INDEX IF NOT EXISTS idx_decision_outcome_log_outcome_timestamp 
  ON public.decision_outcome_log(outcome_timestamp);
CREATE INDEX IF NOT EXISTS idx_decision_outcome_log_domain 
  ON public.decision_outcome_log(domain);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at 
  ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at 
  ON public.automation_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_cps_snapshot_date_iso3 
  ON public.country_performance_snapshots(snapshot_date, iso3);
