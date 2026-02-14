
-- 1. Global Domain Benchmarks table
CREATE TABLE public.global_domain_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  percentile_10 NUMERIC NOT NULL DEFAULT 0,
  percentile_25 NUMERIC NOT NULL DEFAULT 0,
  percentile_50 NUMERIC NOT NULL DEFAULT 50,
  percentile_75 NUMERIC NOT NULL DEFAULT 75,
  percentile_90 NUMERIC NOT NULL DEFAULT 90,
  structural_floor NUMERIC NOT NULL DEFAULT 0,
  structural_ceiling NUMERIC NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.global_domain_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benchmarks are publicly readable"
  ON public.global_domain_benchmarks FOR SELECT USING (true);

CREATE POLICY "Only admins can modify benchmarks"
  ON public.global_domain_benchmarks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed initial benchmark data for core domains
INSERT INTO public.global_domain_benchmarks (domain, percentile_10, percentile_25, percentile_50, percentile_75, percentile_90, structural_floor, structural_ceiling) VALUES
  ('governance', 15, 30, 50, 70, 85, 5, 95),
  ('health', 20, 35, 55, 72, 88, 10, 95),
  ('energy', 10, 25, 45, 65, 82, 5, 95),
  ('finance', 15, 30, 50, 68, 85, 5, 95),
  ('food', 18, 32, 52, 70, 86, 8, 95),
  ('security', 12, 28, 48, 68, 84, 5, 95),
  ('education', 15, 30, 50, 72, 88, 5, 95),
  ('climate', 10, 25, 45, 65, 80, 5, 95),
  ('population', 20, 35, 50, 65, 80, 10, 90);

-- 2. Performance Backtests table
CREATE TABLE public.performance_backtests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iso3 TEXT NOT NULL,
  domain TEXT NOT NULL,
  mae NUMERIC NOT NULL DEFAULT 0,
  rmse NUMERIC NOT NULL DEFAULT 0,
  stability_score NUMERIC NOT NULL DEFAULT 0.5,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_backtests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backtests are publicly readable"
  ON public.performance_backtests FOR SELECT USING (true);

CREATE POLICY "Only admins can modify backtests"
  ON public.performance_backtests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Upgrade country_performance_snapshots with new columns
ALTER TABLE public.country_performance_snapshots
  ADD COLUMN IF NOT EXISTS structural_break_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS systemic_fragility_score NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forecast_stability_score NUMERIC NOT NULL DEFAULT 0.5;
