
-- FIX #1: Create missing evidence_enforcement_log table
CREATE TABLE IF NOT EXISTS public.evidence_enforcement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type text NOT NULL DEFAULT 'scheduled_2h',
  issue_type text NOT NULL,
  issue_count integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'medium',
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evidence_enforcement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read evidence_enforcement_log"
  ON public.evidence_enforcement_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role insert evidence_enforcement_log"
  ON public.evidence_enforcement_log FOR INSERT TO service_role WITH CHECK (true);

-- FIX #2: Create missing daily_target_config table
CREATE TABLE IF NOT EXISTS public.daily_target_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL DEFAULT CURRENT_DATE,
  decisions_target integer NOT NULL DEFAULT 7,
  executions_target integer NOT NULL DEFAULT 3,
  outcomes_target integer NOT NULL DEFAULT 2,
  measured_target integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_date)
);

ALTER TABLE public.daily_target_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read daily_target_config"
  ON public.daily_target_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage daily_target_config"
  ON public.daily_target_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- FIX #3: Create missing criticality_rules table (referenced by ModelDrivenView)
CREATE TABLE IF NOT EXISTS public.criticality_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  severity_threshold numeric NOT NULL DEFAULT 7.0,
  criticality_tier text NOT NULL DEFAULT 'standard',
  requires_dual_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain)
);

ALTER TABLE public.criticality_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read criticality_rules"
  ON public.criticality_rules FOR SELECT TO authenticated USING (true);

-- FIX #4: Create missing education_metrics table
CREATE TABLE IF NOT EXISTS public.education_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_iso3 text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric,
  year integer,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.education_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read education_metrics"
  ON public.education_metrics FOR SELECT TO authenticated USING (true);

-- FIX #5: Fix zombie cron-hourly-crisis-scan (110 errors in 7 days)
-- Clean up stale running entries
UPDATE public.automation_logs 
SET status = 'timeout', message = COALESCE(message, '') || ' [auto-cleanup: forensic audit]'
WHERE job_name = 'cron-hourly-crisis-scan' AND status = 'running'
AND executed_at < NOW() - INTERVAL '10 minutes';

-- FIX #6: Add indexes for enforcement log queries
CREATE INDEX IF NOT EXISTS idx_evidence_enforcement_created 
  ON public.evidence_enforcement_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_target_config_date
  ON public.daily_target_config (target_date);
