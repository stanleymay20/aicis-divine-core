
-- Performance snapshots for time-series intelligence
CREATE TABLE public.country_performance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iso3 TEXT NOT NULL,
  domain TEXT NOT NULL,
  performance_index NUMERIC NOT NULL DEFAULT 0,
  momentum_score NUMERIC NOT NULL DEFAULT 0,
  volatility_index NUMERIC NOT NULL DEFAULT 0,
  risk_pressure_score NUMERIC NOT NULL DEFAULT 0,
  forecast_90d NUMERIC,
  forecast_1y NUMERIC,
  forecast_direction TEXT NOT NULL DEFAULT 'stable' CHECK (forecast_direction IN ('up', 'down', 'stable')),
  confidence_score NUMERIC NOT NULL DEFAULT 50,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast country+domain+time queries
CREATE INDEX idx_perf_snap_iso3_domain ON public.country_performance_snapshots (iso3, domain, snapshot_date DESC);
CREATE INDEX idx_perf_snap_date ON public.country_performance_snapshots (snapshot_date DESC);

-- Enable RLS
ALTER TABLE public.country_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read (aggregate data, non-personal)
CREATE POLICY "Performance snapshots are publicly readable"
  ON public.country_performance_snapshots FOR SELECT
  USING (true);

-- Only service role can insert/update
CREATE POLICY "Service role can manage performance snapshots"
  ON public.country_performance_snapshots FOR ALL
  USING (true)
  WITH CHECK (true);
