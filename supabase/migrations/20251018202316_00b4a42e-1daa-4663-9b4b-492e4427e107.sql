-- Phase 10.10: Learning Allocator (Self-Optimizing Resource Intelligence)

-- Impact Records
CREATE TABLE IF NOT EXISTS public.division_impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  rebalance_run_id UUID REFERENCES public.sc_rebalance_runs(id) ON DELETE SET NULL,
  metric JSONB NOT NULL,
  impact_score NUMERIC(8,4),
  sc_spent NUMERIC(18,6) NOT NULL DEFAULT 0,
  impact_per_sc NUMERIC(12,6),
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_division_impact_metrics_div ON public.division_impact_metrics(division, captured_at DESC);

-- Learned weights per division
CREATE TABLE IF NOT EXISTS public.division_learning_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT UNIQUE NOT NULL,
  impact_weight NUMERIC(8,4) DEFAULT 0.20,
  trend NUMERIC(8,4) DEFAULT 0.0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.division_impact_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.division_learning_weights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "read_auth_impact_metrics" ON public.division_impact_metrics FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "read_auth_learning_weights" ON public.division_learning_weights FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "manage_impact_admin" ON public.division_impact_metrics FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operator'::app_role));
CREATE POLICY "manage_weights_admin" ON public.division_learning_weights FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operator'::app_role));

-- Seed initial learning weights for all divisions
INSERT INTO public.division_learning_weights (division, impact_weight, trend)
VALUES 
  ('finance', 0.20, 0.0),
  ('energy', 0.20, 0.0),
  ('health', 0.20, 0.0),
  ('food', 0.20, 0.0),
  ('governance', 0.20, 0.0),
  ('defense', 0.20, 0.0),
  ('diplomacy', 0.20, 0.0),
  ('crisis', 0.20, 0.0),
  ('system', 0.20, 0.0)
ON CONFLICT (division) DO NOTHING;