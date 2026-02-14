
-- ============================================================
-- COMPOSITE INDEXES for high-query paths
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_perf_snapshots_iso3_domain_date
  ON public.country_performance_snapshots (iso3, domain, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_perf_snapshots_date
  ON public.country_performance_snapshots (snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_benchmarks_domain
  ON public.global_domain_benchmarks (domain);

CREATE INDEX IF NOT EXISTS idx_backtests_iso3_domain
  ON public.performance_backtests (iso3, domain);

CREATE INDEX IF NOT EXISTS idx_alerts_division_severity
  ON public.alerts (division, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_country
  ON public.alerts (country, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crisis_events_status
  ON public.crisis_events (status, severity DESC);

CREATE INDEX IF NOT EXISTS idx_intelligence_signals_type
  ON public.intelligence_signals (signal_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_anomaly_detections_division
  ON public.anomaly_detections (division, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_critical_alerts_level
  ON public.critical_alerts (level, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_source_log_division
  ON public.data_source_log (division, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_action
  ON public.audit_log (user_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_country_profiles_iso3
  ON public.country_profiles (iso3);
