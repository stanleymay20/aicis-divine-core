
-- Add evidence classification and measured outcome columns
ALTER TABLE public.decision_outcome_log 
  ADD COLUMN IF NOT EXISTS evidence_type text NOT NULL DEFAULT 'hypothetical' 
    CHECK (evidence_type IN ('hypothetical', 'pilot', 'measured')),
  ADD COLUMN IF NOT EXISTS measured_outcome text,
  ADD COLUMN IF NOT EXISTS measured_impact_score numeric,
  ADD COLUMN IF NOT EXISTS pilot_partner text,
  ADD COLUMN IF NOT EXISTS pilot_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pilot_ended_at timestamptz;

-- Update existing entries to hypothetical
UPDATE public.decision_outcome_log SET evidence_type = 'hypothetical' WHERE evidence_type IS NULL;
