-- Phase 10.9: Autonomous Cross-Division Resource Balancing

-- Division KPI snapshots
CREATE TABLE IF NOT EXISTS public.division_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL CHECK (division IN
    ('finance','energy','health','food','governance','defense','diplomacy','crisis','system')),
  metric JSONB NOT NULL,
  composite_score NUMERIC(6,2),
  risk_score NUMERIC(6,2),
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_division_kpis_div_at ON public.division_kpis(division, captured_at DESC);

-- Allocation policy
CREATE TABLE IF NOT EXISTS public.sc_allocation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT UNIQUE NOT NULL,
  description_md TEXT,
  weights JSONB NOT NULL DEFAULT '{
    "need": 0.45,
    "risk": 0.35,
    "impact": 0.20
  }',
  constraints JSONB NOT NULL DEFAULT '{
    "min_pct_per_division": 0.05,
    "max_pct_per_division": 0.35,
    "max_move_per_epoch_sc": 20000,
    "require_approval_over_sc": 5000
  }',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rebalance runs
CREATE TABLE IF NOT EXISTS public.sc_rebalance_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('simulate','execute')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  total_available_sc NUMERIC(18,6) DEFAULT 0,
  total_moved_sc NUMERIC(18,6) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Individual moves
CREATE TABLE IF NOT EXISTS public.sc_rebalance_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.sc_rebalance_runs(id) ON DELETE CASCADE,
  from_division TEXT,
  to_division TEXT,
  amount_sc NUMERIC(18,6) CHECK (amount_sc > 0),
  reason TEXT,
  requires_approval BOOLEAN DEFAULT FALSE,
  executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  ledger_tx JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sc_rebalance_moves_run ON public.sc_rebalance_moves(run_id);

-- Enable RLS
ALTER TABLE public.division_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sc_allocation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sc_rebalance_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sc_rebalance_moves ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "read_auth_kpis" ON public.division_kpis FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "read_auth_policies" ON public.sc_allocation_policies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "read_auth_runs" ON public.sc_rebalance_runs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "read_auth_moves" ON public.sc_rebalance_moves FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "manage_policies_admin" ON public.sc_allocation_policies FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operator'::app_role));
CREATE POLICY "manage_runs_admin" ON public.sc_rebalance_runs FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operator'::app_role));
CREATE POLICY "manage_moves_admin" ON public.sc_rebalance_moves FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operator'::app_role));

-- Seed default policy
INSERT INTO public.sc_allocation_policies (policy_key, description_md)
VALUES ('default_v1', 'Default cross-division allocator: favors urgent risk & unmet need with caps.')
ON CONFLICT (policy_key) DO NOTHING;