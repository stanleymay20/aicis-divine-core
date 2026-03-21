-- Extend decision_models with training maturity
ALTER TABLE public.decision_models
  ADD COLUMN training_mode text NOT NULL DEFAULT 'heuristic',
  ADD COLUMN real_sample_count integer NOT NULL DEFAULT 0,
  ADD COLUMN proxy_sample_count integer NOT NULL DEFAULT 0,
  ADD COLUMN measured_sample_count integer NOT NULL DEFAULT 0;

-- Extend decision_training_dataset with label provenance
ALTER TABLE public.decision_training_dataset
  ADD COLUMN label_source text NOT NULL DEFAULT 'proxy',
  ADD COLUMN label_confidence double precision,
  ADD COLUMN proxy_reason text,
  ADD COLUMN overridden_by_real boolean NOT NULL DEFAULT false;

-- Decision inference audit log
CREATE TABLE public.decision_inference_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version text NOT NULL,
  training_mode text NOT NULL,
  scope_iso3 text,
  scope_domain text,
  feature_vector jsonb NOT NULL,
  weights_used jsonb NOT NULL,
  risk_score double precision NOT NULL,
  chosen_actions jsonb NOT NULL,
  policy_classifications jsonb NOT NULL,
  signal_counts jsonb,
  inference_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inference_audit_created ON public.decision_inference_audit(created_at DESC);
CREATE INDEX idx_inference_audit_model ON public.decision_inference_audit(model_version);

ALTER TABLE public.decision_inference_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read inference audit"
  ON public.decision_inference_audit FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role inserts inference audit"
  ON public.decision_inference_audit FOR INSERT TO service_role WITH CHECK (true)