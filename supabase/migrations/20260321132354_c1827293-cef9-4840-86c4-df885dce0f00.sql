
-- 1. Add acceptance tracking to decision_outcome_log
ALTER TABLE public.decision_outcome_log 
  ADD COLUMN IF NOT EXISTS recommendation_accepted BOOLEAN,
  ADD COLUMN IF NOT EXISTS recommendation_rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMP WITH TIME ZONE;

-- 2. Create model_evaluations table
CREATE TABLE IF NOT EXISTS public.model_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL,
  compared_to_version TEXT,
  evaluation_type TEXT NOT NULL DEFAULT 'periodic',
  proxy_success_rate NUMERIC,
  real_success_rate NUMERIC,
  measured_success_rate NUMERIC,
  avg_impact_score NUMERIC,
  acceptance_rate NUMERIC,
  act_precision NUMERIC,
  consider_precision NUMERIC,
  calibration_error NUMERIC,
  confidence_buckets JSONB,
  sample_count INT DEFAULT 0,
  metadata JSONB,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.model_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read model_evaluations" ON public.model_evaluations FOR SELECT TO authenticated USING (true);

-- 3. Create action_effectiveness view
CREATE OR REPLACE VIEW public.action_effectiveness AS
SELECT
  action_type,
  domain,
  COUNT(*) AS times_recommended,
  COUNT(*) FILTER (WHERE recommendation_accepted = true) AS times_accepted,
  COUNT(*) FILTER (WHERE outcome_success = true) AS times_successful,
  ROUND(AVG(impact_score)::numeric, 1) AS avg_impact,
  ROUND(AVG(CASE WHEN outcome_success IS NOT NULL THEN 
    CASE WHEN outcome_success THEN 1.0 ELSE 0.0 END
  END)::numeric * 100, 1) AS success_rate_pct
FROM public.decision_outcome_log
WHERE action_type IS NOT NULL
GROUP BY action_type, domain;

-- 4. Add per-action weights to decision_models
ALTER TABLE public.decision_models
  ADD COLUMN IF NOT EXISTS action_adjustment_weights JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confidence_calibration JSONB DEFAULT '{}';
