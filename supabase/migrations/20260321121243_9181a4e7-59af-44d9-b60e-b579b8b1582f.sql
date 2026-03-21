
-- Add domain-specific fields to decision_models
ALTER TABLE public.decision_models 
  ADD COLUMN IF NOT EXISTS domain_feature_weights JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS domain_action_policies JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_calibrated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avg_impact_score FLOAT,
  ADD COLUMN IF NOT EXISTS recommendation_acceptance_rate FLOAT,
  ADD COLUMN IF NOT EXISTS outcome_maturity_ratio FLOAT;

-- Add context_window_days to training dataset metadata
ALTER TABLE public.decision_training_dataset
  ADD COLUMN IF NOT EXISTS context_window_days INT DEFAULT 30;
