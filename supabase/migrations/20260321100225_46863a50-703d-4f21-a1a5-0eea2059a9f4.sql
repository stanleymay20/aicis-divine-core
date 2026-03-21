CREATE TABLE public.decision_outcome_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id text NOT NULL,
  signal_title text NOT NULL,
  iso3 text,
  domain text,
  signal_date date NOT NULL,
  signal_direction text,
  signal_confidence numeric,
  recommended_action text,
  action_window_days integer DEFAULT 7,
  event_confirmed boolean DEFAULT false,
  event_confirmed_date date,
  event_description text,
  hypothetical_decision_value text,
  pilot_action_taken text,
  pilot_outcome text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.decision_outcome_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read decision outcome log"
  ON public.decision_outcome_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage decision outcome log"
  ON public.decision_outcome_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));