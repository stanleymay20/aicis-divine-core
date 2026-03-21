-- Data Lifecycle Registry: governs every dataset in the platform
CREATE TABLE public.data_lifecycle_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  source text,
  description text,
  pipeline text,
  tier text NOT NULL DEFAULT 'warm' CHECK (tier IN ('hot', 'warm', 'cold', 'audit')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dormant', 'reserved', 'deprecated')),
  criticality text NOT NULL DEFAULT 'low' CHECK (criticality IN ('critical', 'important', 'low', 'experimental')),
  retention_days integer,
  owner text DEFAULT 'system',
  refresh_frequency text,
  last_refreshed_at timestamptz,
  row_count_estimate bigint DEFAULT 0,
  size_estimate_mb numeric DEFAULT 0,
  growth_rate_daily numeric DEFAULT 0,
  staleness_threshold_hours integer DEFAULT 48,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.data_lifecycle_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read data lifecycle registry"
  ON public.data_lifecycle_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage data lifecycle registry"
  ON public.data_lifecycle_registry FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Pipeline health tracking table
CREATE TABLE public.pipeline_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name text NOT NULL,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer DEFAULT 0,
  total_runs integer DEFAULT 0,
  total_successes integer DEFAULT 0,
  avg_duration_ms integer,
  status text DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'failing', 'stale', 'disabled')),
  staleness_threshold_hours integer DEFAULT 24,
  alert_triggered boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pipeline_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pipeline health"
  ON public.pipeline_health FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage pipeline health"
  ON public.pipeline_health FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));