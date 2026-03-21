
ALTER TABLE public.decision_outcome_log
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS evidence_note text,
  ADD COLUMN IF NOT EXISTS evidence_source_type text CHECK (evidence_source_type IN ('internal_report', 'partner_memo', 'media_source', 'field_observation', 'quantitative_analysis', 'other'));
