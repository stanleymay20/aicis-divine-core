
-- 1. Make decision_review_history truly append-only with a trigger preventing UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.prevent_review_history_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'decision_review_history is immutable — UPDATE and DELETE are prohibited';
END;
$$;

CREATE TRIGGER trg_prevent_review_history_update
  BEFORE UPDATE ON public.decision_review_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_review_history_mutation();

CREATE TRIGGER trg_prevent_review_history_delete
  BEFORE DELETE ON public.decision_review_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_review_history_mutation();

-- 2. Add decision criticality tiers and separation-of-duties columns
ALTER TABLE public.decision_outcome_log
  ADD COLUMN IF NOT EXISTS criticality_tier text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS requires_dual_approval boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS second_reviewer_name text,
  ADD COLUMN IF NOT EXISTS second_reviewer_role text,
  ADD COLUMN IF NOT EXISTS second_review_status text,
  ADD COLUMN IF NOT EXISTS second_review_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recommender_id text,
  ADD COLUMN IF NOT EXISTS separation_of_duties_verified boolean DEFAULT false;

-- 3. Create decision_criticality_rules table
CREATE TABLE IF NOT EXISTS public.decision_criticality_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  policy text NOT NULL,
  criticality_tier text NOT NULL DEFAULT 'standard',
  requires_dual_approval boolean NOT NULL DEFAULT false,
  min_impact_for_critical integer DEFAULT 70,
  min_probability_for_critical numeric DEFAULT 0.8,
  created_at timestamptz DEFAULT now(),
  UNIQUE(domain, policy)
);

-- Seed default criticality rules
INSERT INTO public.decision_criticality_rules (domain, policy, criticality_tier, requires_dual_approval) VALUES
  ('security', 'ACT', 'critical', true),
  ('security', 'CONSIDER', 'elevated', false),
  ('security', 'MONITOR', 'standard', false),
  ('health', 'ACT', 'critical', true),
  ('health', 'CONSIDER', 'elevated', false),
  ('health', 'MONITOR', 'standard', false),
  ('finance', 'ACT', 'elevated', false),
  ('finance', 'CONSIDER', 'standard', false),
  ('finance', 'MONITOR', 'standard', false),
  ('governance', 'ACT', 'critical', true),
  ('governance', 'CONSIDER', 'elevated', false),
  ('governance', 'MONITOR', 'standard', false),
  ('energy', 'ACT', 'elevated', false),
  ('energy', 'CONSIDER', 'standard', false),
  ('energy', 'MONITOR', 'standard', false),
  ('food', 'ACT', 'elevated', false),
  ('food', 'CONSIDER', 'standard', false),
  ('food', 'MONITOR', 'standard', false),
  ('system', 'ACT', 'elevated', false),
  ('system', 'CONSIDER', 'standard', false),
  ('system', 'MONITOR', 'standard', false)
ON CONFLICT (domain, policy) DO NOTHING;

ALTER TABLE public.decision_criticality_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read criticality rules"
  ON public.decision_criticality_rules FOR SELECT TO authenticated USING (true);
