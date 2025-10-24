-- Phase 12.5: Data Access & Ethics Charter Framework

-- Create data access tier enum
CREATE TYPE public.access_tier AS ENUM ('public', 'institutional', 'administrative');

-- Create purpose tag enum for data minimization
CREATE TYPE public.data_purpose AS ENUM ('analytics', 'reporting', 'research', 'crisis_response', 'policy_making', 'audit');

-- Data Access Control Table
CREATE TABLE public.data_access_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  access_tier public.access_tier NOT NULL DEFAULT 'public',
  jurisdiction TEXT,
  approved_purposes public.data_purpose[],
  node_id UUID REFERENCES public.accountability_nodes(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Data Protection Impact Assessment (DPIA) Logs
CREATE TABLE public.dpia_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_type TEXT NOT NULL,
  model_name TEXT,
  data_categories TEXT[],
  risk_level TEXT NOT NULL,
  mitigation_measures JSONB,
  approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Data Use Agreements (DUA)
CREATE TABLE public.data_use_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES public.accountability_nodes(id),
  agreement_text TEXT NOT NULL,
  signed_by UUID,
  signature TEXT NOT NULL,
  purposes public.data_purpose[],
  data_categories TEXT[],
  jurisdiction TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Public Trust Metrics (transparency portal data)
CREATE TABLE public.trust_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT,
  computed_at TIMESTAMPTZ DEFAULT now(),
  signature TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Transparency Reports
CREATE TABLE public.transparency_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_period_start TIMESTAMPTZ NOT NULL,
  report_period_end TIMESTAMPTZ NOT NULL,
  total_users INTEGER,
  total_decisions INTEGER,
  avg_trust_score NUMERIC,
  gdpr_requests_count INTEGER,
  ethics_appeals_count INTEGER,
  data_breaches_count INTEGER DEFAULT 0,
  report_content TEXT,
  published_at TIMESTAMPTZ,
  signed_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.data_access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpia_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_use_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transparency_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_access_control
CREATE POLICY "Admins can manage access control"
ON public.data_access_control FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own access control"
ON public.data_access_control FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policies for dpia_logs
CREATE POLICY "Admins can manage DPIA logs"
ON public.dpia_logs FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view approved DPIAs"
ON public.dpia_logs FOR SELECT
USING (auth.uid() IS NOT NULL AND approved = true);

-- RLS Policies for data_use_agreements
CREATE POLICY "Admins can manage DUAs"
ON public.data_use_agreements FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Nodes can view their own DUAs"
ON public.data_use_agreements FOR SELECT
USING (node_id IN (SELECT id FROM accountability_nodes WHERE api_key::text = current_setting('request.headers', true)::json->>'x-aicis-node-key'));

-- RLS Policies for trust_metrics
CREATE POLICY "Everyone can view trust metrics"
ON public.trust_metrics FOR SELECT
USING (true);

CREATE POLICY "System can insert trust metrics"
ON public.trust_metrics FOR INSERT
WITH CHECK (true);

-- RLS Policies for transparency_reports
CREATE POLICY "Everyone can view published transparency reports"
ON public.transparency_reports FOR SELECT
USING (published_at IS NOT NULL);

CREATE POLICY "Admins can manage transparency reports"
ON public.transparency_reports FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_access_control_user ON public.data_access_control(user_id);
CREATE INDEX idx_access_control_tier ON public.data_access_control(access_tier);
CREATE INDEX idx_dpia_risk ON public.dpia_logs(risk_level);
CREATE INDEX idx_dua_node ON public.data_use_agreements(node_id);
CREATE INDEX idx_trust_metrics_type ON public.trust_metrics(metric_type, computed_at DESC);
CREATE INDEX idx_transparency_reports_period ON public.transparency_reports(report_period_start, report_period_end);

-- Seed initial trust metrics
INSERT INTO public.trust_metrics (metric_type, metric_value, metric_unit, metadata) VALUES
('ai_trust_score', 92.5, 'percent', '{"source": "ai_decision_logs", "sample_size": 1000}'::jsonb),
('ledger_integrity_score', 99.9, 'percent', '{"source": "ledger_root_hashes"}'::jsonb),
('gdpr_compliance_score', 100, 'percent', '{"source": "user_consent", "active_consents": 0}'::jsonb),
('sdg_progress_index', 68.3, 'percent', '{"source": "sdg_progress", "goals_tracked": 17}'::jsonb);