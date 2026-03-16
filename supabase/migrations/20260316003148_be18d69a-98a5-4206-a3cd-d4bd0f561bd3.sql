
-- ADI: Decision Recommendations table
CREATE TABLE public.adi_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_source text NOT NULL,
  signal_id uuid,
  signal_summary text NOT NULL,
  region text,
  country_iso3 text,
  domain text NOT NULL,
  severity_score numeric NOT NULL DEFAULT 0,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_option_rank int,
  reasoning_md text,
  confidence numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  outcome_assessment text,
  outcome_score numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ADI: Scenario Simulations table
CREATE TABLE public.adi_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.adi_decisions(id) ON DELETE CASCADE,
  scenario_name text NOT NULL,
  scenario_type text NOT NULL DEFAULT 'what_if',
  input_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  projection_30d jsonb DEFAULT '{}'::jsonb,
  projection_60d jsonb DEFAULT '{}'::jsonb,
  projection_90d jsonb DEFAULT '{}'::jsonb,
  probability_tree jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0,
  reasoning_md text,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- ADI: Conflict Early Warning table
CREATE TABLE public.conflict_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_iso3 text NOT NULL,
  region text NOT NULL,
  protest_momentum numeric DEFAULT 0,
  conflict_intensity numeric DEFAULT 0,
  military_escalation numeric DEFAULT 0,
  diplomatic_tension numeric DEFAULT 0,
  media_hostility_index numeric DEFAULT 0,
  escalation_probability numeric DEFAULT 0,
  time_to_conflict_days numeric,
  conflict_type text,
  involved_parties jsonb DEFAULT '[]'::jsonb,
  triggers jsonb DEFAULT '[]'::jsonb,
  historical_parallels jsonb DEFAULT '[]'::jsonb,
  assessment_md text,
  data_sources jsonb DEFAULT '[]'::jsonb,
  confidence numeric DEFAULT 0,
  status text DEFAULT 'active',
  materialized_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.adi_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adi_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ADI decisions" ON public.adi_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read ADI scenarios" ON public.adi_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read conflict signals" ON public.conflict_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert ADI decisions" ON public.adi_decisions FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update ADI decisions" ON public.adi_decisions FOR UPDATE TO service_role USING (true);
CREATE POLICY "Service role can insert ADI scenarios" ON public.adi_scenarios FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can insert conflict signals" ON public.conflict_signals FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update conflict signals" ON public.conflict_signals FOR UPDATE TO service_role USING (true);
CREATE POLICY "Authenticated users can update ADI decisions" ON public.adi_decisions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ADI scenarios" ON public.adi_scenarios FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.conflict_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.adi_decisions;

CREATE TRIGGER update_adi_decisions_updated_at BEFORE UPDATE ON public.adi_decisions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conflict_signals_updated_at BEFORE UPDATE ON public.conflict_signals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
