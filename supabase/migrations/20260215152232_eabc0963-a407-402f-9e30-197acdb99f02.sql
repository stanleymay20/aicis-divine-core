
-- ============================================================
-- INSTITUTIONAL HARDENING: RLS Policy Fix + Indexes + Triggers
-- ============================================================

-- ── 1. Fix permissive INSERT policies (restrict to service_role only) ──

-- ai_decision_logs
DROP POLICY IF EXISTS "System can insert AI decision logs" ON public.ai_decision_logs;
CREATE POLICY "Service role can insert AI decision logs"
  ON public.ai_decision_logs FOR INSERT TO service_role WITH CHECK (true);

-- ai_learning_log
DROP POLICY IF EXISTS "System can insert learning log" ON public.ai_learning_log;
CREATE POLICY "Service role can insert learning log"
  ON public.ai_learning_log FOR INSERT TO service_role WITH CHECK (true);

-- alerts
DROP POLICY IF EXISTS "System can insert alerts" ON public.alerts;
CREATE POLICY "Service role can insert alerts"
  ON public.alerts FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Admins can insert alerts"
  ON public.alerts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- audit_log
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_log FOR INSERT TO service_role WITH CHECK (true);

-- automation_logs
DROP POLICY IF EXISTS "insert_system_only" ON public.automation_logs;
CREATE POLICY "Service role can insert automation logs"
  ON public.automation_logs FOR INSERT TO service_role WITH CHECK (true);

-- compliance_audit
DROP POLICY IF EXISTS "System can insert compliance audit" ON public.compliance_audit;
CREATE POLICY "Service role can insert compliance audit"
  ON public.compliance_audit FOR INSERT TO service_role WITH CHECK (true);

-- country_profiles
DROP POLICY IF EXISTS "insert_profiles" ON public.country_profiles;
DROP POLICY IF EXISTS "update_profiles" ON public.country_profiles;
CREATE POLICY "Service role can insert country profiles"
  ON public.country_profiles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update country profiles"
  ON public.country_profiles FOR UPDATE TO service_role USING (true);

-- critical_alerts
DROP POLICY IF EXISTS "w_ca_sys" ON public.critical_alerts;
CREATE POLICY "Service role can insert critical alerts"
  ON public.critical_alerts FOR INSERT TO service_role WITH CHECK (true);

-- data_source_log
DROP POLICY IF EXISTS "Data logs writable by system" ON public.data_source_log;
CREATE POLICY "Service role can insert data source log"
  ON public.data_source_log FOR INSERT TO service_role WITH CHECK (true);

-- diagnostics_log
DROP POLICY IF EXISTS "write_diagnostics_sys" ON public.diagnostics_log;
CREATE POLICY "Service role can insert diagnostics log"
  ON public.diagnostics_log FOR INSERT TO service_role WITH CHECK (true);

-- finance_data
DROP POLICY IF EXISTS "finance_data_system_insert" ON public.finance_data;
CREATE POLICY "Service role can insert finance data"
  ON public.finance_data FOR INSERT TO service_role WITH CHECK (true);

-- food_data
DROP POLICY IF EXISTS "food_data_system_insert" ON public.food_data;
CREATE POLICY "Service role can insert food data"
  ON public.food_data FOR INSERT TO service_role WITH CHECK (true);

-- geo_catalog
DROP POLICY IF EXISTS "insert_system_geo" ON public.geo_catalog;
CREATE POLICY "Service role can insert geo catalog"
  ON public.geo_catalog FOR INSERT TO service_role WITH CHECK (true);

-- governance_global
DROP POLICY IF EXISTS "governance_system_insert" ON public.governance_global;
CREATE POLICY "Service role can insert governance global"
  ON public.governance_global FOR INSERT TO service_role WITH CHECK (true);

-- health_metrics
DROP POLICY IF EXISTS "health_metrics_system_insert" ON public.health_metrics;
CREATE POLICY "Service role can insert health metrics"
  ON public.health_metrics FOR INSERT TO service_role WITH CHECK (true);

-- ledger_entries
DROP POLICY IF EXISTS "Nodes can insert ledger entries" ON public.ledger_entries;
CREATE POLICY "Service role can insert ledger entries"
  ON public.ledger_entries FOR INSERT TO service_role WITH CHECK (true);

-- ledger_root_hashes
DROP POLICY IF EXISTS "System can insert root hashes" ON public.ledger_root_hashes;
CREATE POLICY "Service role can insert root hashes"
  ON public.ledger_root_hashes FOR INSERT TO service_role WITH CHECK (true);

-- metrics
DROP POLICY IF EXISTS "insert_system_metrics" ON public.metrics;
CREATE POLICY "Service role can insert metrics"
  ON public.metrics FOR INSERT TO service_role WITH CHECK (true);

-- node_audit_trail
DROP POLICY IF EXISTS "System can insert audit trails" ON public.node_audit_trail;
CREATE POLICY "Service role can insert audit trails"
  ON public.node_audit_trail FOR INSERT TO service_role WITH CHECK (true);

-- notifications
DROP POLICY IF EXISTS "system_insert_notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT TO service_role WITH CHECK (true);

-- objective_tasks
DROP POLICY IF EXISTS "System can insert tasks" ON public.objective_tasks;
DROP POLICY IF EXISTS "System can update tasks" ON public.objective_tasks;
CREATE POLICY "Service role can insert tasks"
  ON public.objective_tasks FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update tasks"
  ON public.objective_tasks FOR UPDATE TO service_role USING (true);

-- population_projection
DROP POLICY IF EXISTS "population_system_insert" ON public.population_projection;
CREATE POLICY "Service role can insert population projection"
  ON public.population_projection FOR INSERT TO service_role WITH CHECK (true);

-- predicted_scores
DROP POLICY IF EXISTS "write_pred_scores_sys" ON public.predicted_scores;
CREATE POLICY "Service role can insert predicted scores"
  ON public.predicted_scores FOR INSERT TO service_role WITH CHECK (true);

-- predictions
DROP POLICY IF EXISTS "System can insert predictions" ON public.predictions;
CREATE POLICY "Service role can insert predictions"
  ON public.predictions FOR INSERT TO service_role WITH CHECK (true);

-- revenue_metrics
DROP POLICY IF EXISTS "System can insert revenue metrics" ON public.revenue_metrics;
CREATE POLICY "Service role can insert revenue metrics"
  ON public.revenue_metrics FOR INSERT TO service_role WITH CHECK (true);

-- satellite_observations
DROP POLICY IF EXISTS "write_sat_obs_sys" ON public.satellite_observations;
CREATE POLICY "Service role can insert satellite observations"
  ON public.satellite_observations FOR INSERT TO service_role WITH CHECK (true);

-- sc_oracle_prices
DROP POLICY IF EXISTS "System can insert oracle prices" ON public.sc_oracle_prices;
CREATE POLICY "Service role can insert oracle prices"
  ON public.sc_oracle_prices FOR INSERT TO service_role WITH CHECK (true);

-- sdg_progress
DROP POLICY IF EXISTS "System can insert SDG progress" ON public.sdg_progress;
DROP POLICY IF EXISTS "System can update SDG progress" ON public.sdg_progress;
CREATE POLICY "Service role can insert SDG progress"
  ON public.sdg_progress FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update SDG progress"
  ON public.sdg_progress FOR UPDATE TO service_role USING (true);

-- security_events
DROP POLICY IF EXISTS "security_events_system_insert" ON public.security_events;
CREATE POLICY "Service role can insert security events"
  ON public.security_events FOR INSERT TO service_role WITH CHECK (true);

-- security_incidents
DROP POLICY IF EXISTS "w_si_sys" ON public.security_incidents;
CREATE POLICY "Service role can insert security incidents"
  ON public.security_incidents FOR INSERT TO service_role WITH CHECK (true);

-- system_errors
DROP POLICY IF EXISTS "write_sys_errors" ON public.system_errors;
CREATE POLICY "Service role can insert system errors"
  ON public.system_errors FOR INSERT TO service_role WITH CHECK (true);

-- system_health
DROP POLICY IF EXISTS "System can insert health checks" ON public.system_health;
CREATE POLICY "Service role can insert health checks"
  ON public.system_health FOR INSERT TO service_role WITH CHECK (true);

-- tenant_action_log
DROP POLICY IF EXISTS "System can insert action logs" ON public.tenant_action_log;
CREATE POLICY "Service role can insert action logs"
  ON public.tenant_action_log FOR INSERT TO service_role WITH CHECK (true);

-- trust_metrics
DROP POLICY IF EXISTS "System can insert trust metrics" ON public.trust_metrics;
CREATE POLICY "Service role can insert trust metrics"
  ON public.trust_metrics FOR INSERT TO service_role WITH CHECK (true);

-- vulnerability_scores
DROP POLICY IF EXISTS "vulnerability_system_insert" ON public.vulnerability_scores;
CREATE POLICY "Service role can insert vulnerability scores"
  ON public.vulnerability_scores FOR INSERT TO service_role WITH CHECK (true);

-- webhook_event_log
DROP POLICY IF EXISTS "System can insert webhook logs" ON public.webhook_event_log;
CREATE POLICY "Service role can insert webhook logs"
  ON public.webhook_event_log FOR INSERT TO service_role WITH CHECK (true);

-- ── 2. Composite indexes for hot query paths ──

CREATE INDEX IF NOT EXISTS idx_snapshots_iso3_domain_date 
  ON public.country_performance_snapshots (iso3, domain, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_division_severity 
  ON public.alerts (division, severity) WHERE acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_predictions_division_date 
  ON public.predictions (division, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_source_log_division_status 
  ON public.data_source_log (division, status);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_action 
  ON public.audit_log (user_id, action);

-- ── 3. Attach update_updated_at triggers ──

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_country_profiles_updated_at') THEN
    CREATE TRIGGER trg_country_profiles_updated_at
      BEFORE UPDATE ON public.country_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crisis_events_updated_at') THEN
    CREATE TRIGGER trg_crisis_events_updated_at
      BEFORE UPDATE ON public.crisis_events
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_anomaly_detections_updated_at') THEN
    CREATE TRIGGER trg_anomaly_detections_updated_at
      BEFORE UPDATE ON public.anomaly_detections
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_defense_posture_updated_at') THEN
    CREATE TRIGGER trg_defense_posture_updated_at
      BEFORE UPDATE ON public.defense_posture
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_data_retention_updated_at') THEN
    CREATE TRIGGER trg_data_retention_updated_at
      BEFORE UPDATE ON public.data_retention_policies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_assets_updated_at') THEN
    CREATE TRIGGER trg_brand_assets_updated_at
      BEFORE UPDATE ON public.brand_assets
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_custom_domains_updated_at') THEN
    CREATE TRIGGER trg_custom_domains_updated_at
      BEFORE UPDATE ON public.custom_domains
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_diplo_signals_updated_at') THEN
    CREATE TRIGGER trg_diplo_signals_updated_at
      BEFORE UPDATE ON public.diplo_signals
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
