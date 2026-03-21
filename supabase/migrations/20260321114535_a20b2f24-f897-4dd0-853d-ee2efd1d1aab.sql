-- Extend decision_outcome_log for outcome tracking
ALTER TABLE public.decision_outcome_log
  ADD COLUMN action_type text,
  ADD COLUMN action_taken boolean DEFAULT false,
  ADD COLUMN action_timestamp timestamptz,
  ADD COLUMN outcome_success boolean,
  ADD COLUMN outcome_timestamp timestamptz,
  ADD COLUMN impact_score double precision,
  ADD COLUMN time_to_outcome_days integer,
  ADD COLUMN decision_features jsonb;

-- Training dataset for decision models
CREATE TABLE public.decision_training_dataset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso3 text,
  domain text,
  features jsonb NOT NULL,
  action_type text NOT NULL,
  outcome_success boolean,
  impact_score double precision,
  source_type text NOT NULL DEFAULT 'proxy',
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decision_training_domain ON public.decision_training_dataset(domain);
CREATE INDEX idx_decision_training_created ON public.decision_training_dataset(created_at DESC);

ALTER TABLE public.decision_training_dataset ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read training data"
  ON public.decision_training_dataset FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role inserts training data"
  ON public.decision_training_dataset FOR INSERT TO service_role WITH CHECK (true);

-- Decision models registry
CREATE TABLE public.decision_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  model_type text NOT NULL,
  feature_schema jsonb NOT NULL,
  feature_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  performance_metrics jsonb,
  training_sample_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read decision models"
  ON public.decision_models FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages decision models"
  ON public.decision_models FOR ALL TO service_role USING (true) WITH CHECK (true)