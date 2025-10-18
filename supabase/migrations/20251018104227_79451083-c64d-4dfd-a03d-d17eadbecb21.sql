-- Phase 5: Governance, Defense, Diplomacy & Crisis Response

-- Governance policy insights
CREATE TABLE IF NOT EXISTS public.gov_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  topic TEXT NOT NULL,
  source_url TEXT,
  summary_md TEXT,
  compliance_level TEXT CHECK (compliance_level IN ('compliant', 'review', 'non-compliant')),
  last_reviewed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_policies_jurisdiction ON public.gov_policies(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_gov_policies_topic ON public.gov_policies(topic);

ALTER TABLE public.gov_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gov policies viewable by authenticated users"
  ON public.gov_policies FOR SELECT
  USING (true);

CREATE POLICY "Admins and operators can manage gov policies"
  ON public.gov_policies FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Defensive security posture
CREATE TABLE IF NOT EXISTS public.defense_posture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  threat_level INTEGER DEFAULT 0 CHECK (threat_level >= 0 AND threat_level <= 10),
  advisories_md TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defense_posture_region ON public.defense_posture(region);

ALTER TABLE public.defense_posture ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Defense posture viewable by authenticated users"
  ON public.defense_posture FOR SELECT
  USING (true);

CREATE POLICY "Admins and operators can manage defense posture"
  ON public.defense_posture FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Diplomatic & geopolitical signals
CREATE TABLE IF NOT EXISTS public.diplo_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  sentiment NUMERIC(5,2) CHECK (sentiment >= -1.00 AND sentiment <= 1.00),
  risk_index NUMERIC(5,2) CHECK (risk_index >= 0 AND risk_index <= 100),
  summary_md TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diplo_country ON public.diplo_signals(country);

ALTER TABLE public.diplo_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diplo signals viewable by authenticated users"
  ON public.diplo_signals FOR SELECT
  USING (true);

CREATE POLICY "Admins and operators can manage diplo signals"
  ON public.diplo_signals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Crisis events & response tracker
CREATE TABLE IF NOT EXISTS public.crisis_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('weather', 'seismic', 'outage', 'health', 'other')),
  region TEXT NOT NULL,
  severity INTEGER DEFAULT 0 CHECK (severity >= 0 AND severity <= 10),
  status TEXT DEFAULT 'monitoring' CHECK (status IN ('monitoring', 'escalated', 'resolved')),
  details_md TEXT,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crisis_events_region ON public.crisis_events(region);
CREATE INDEX IF NOT EXISTS idx_crisis_events_status ON public.crisis_events(status);
CREATE INDEX IF NOT EXISTS idx_crisis_events_severity ON public.crisis_events(severity);

ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crisis events viewable by authenticated users"
  ON public.crisis_events FOR SELECT
  USING (true);

CREATE POLICY "Admins and operators can manage crisis events"
  ON public.crisis_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Approvals (human-in-the-loop)
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  division TEXT NOT NULL CHECK (division IN ('governance', 'defense', 'diplomacy', 'crisis', 'other')),
  action TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  decided_at TIMESTAMP WITH TIME ZONE,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_requester ON public.approvals(requester);
CREATE INDEX IF NOT EXISTS idx_approvals_division ON public.approvals(division);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approvals viewable by authenticated users"
  ON public.approvals FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create approval requests"
  ON public.approvals FOR INSERT
  WITH CHECK (auth.uid() = requester);

CREATE POLICY "Admins can decide approvals"
  ON public.approvals FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_gov_policies_updated_at
  BEFORE UPDATE ON public.gov_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_defense_posture_updated_at
  BEFORE UPDATE ON public.defense_posture
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_diplo_signals_updated_at
  BEFORE UPDATE ON public.diplo_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crisis_events_updated_at
  BEFORE UPDATE ON public.crisis_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();