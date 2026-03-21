-- Recommendation runs audit table for traceability and replay
CREATE TABLE public.decision_recommendation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_country_iso3 text NOT NULL DEFAULT 'global',
  scope_domain text NOT NULL DEFAULT 'all',
  evidence_density text NOT NULL,
  signal_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_used text NOT NULL,
  recommendation_count integer NOT NULL DEFAULT 0,
  global_assessment text,
  recommendations_payload jsonb,
  outcome_trained boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendation_runs_created ON public.decision_recommendation_runs(created_at DESC);

ALTER TABLE public.decision_recommendation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recommendation runs"
  ON public.decision_recommendation_runs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can insert recommendation runs"
  ON public.decision_recommendation_runs FOR INSERT TO service_role
  WITH CHECK (true);

-- Unique partial index to prevent duplicate captures from decision engine
CREATE UNIQUE INDEX idx_decision_outcome_log_signal_unique 
  ON public.decision_outcome_log(signal_id, evidence_source_type) 
  WHERE evidence_source_type = 'decision-engine'