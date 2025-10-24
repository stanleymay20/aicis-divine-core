-- Phase 12.2 & 12.3: UN/SDG Integration + AI Ethics Framework

-- 1. GDPR & Privacy Compliance
CREATE TABLE IF NOT EXISTS public.user_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT NOT NULL DEFAULT '1.0',
  retention_days INTEGER NOT NULL DEFAULT 365,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  max_days INTEGER NOT NULL,
  auto_delete BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SDG Alignment Schema
CREATE TABLE IF NOT EXISTS public.sdg_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_key TEXT NOT NULL,
  sdg_goal INTEGER NOT NULL CHECK (sdg_goal BETWEEN 1 AND 17),
  sdg_target TEXT NOT NULL,
  indicator TEXT NOT NULL,
  metric_source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sdg_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal INTEGER NOT NULL CHECK (goal BETWEEN 1 AND 17),
  target TEXT NOT NULL,
  current_value NUMERIC,
  progress_percent NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. AI Ethics & Decision Logging
CREATE TABLE IF NOT EXISTS public.ai_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  division_key TEXT NOT NULL,
  input_summary TEXT NOT NULL,
  output_summary TEXT NOT NULL,
  confidence NUMERIC,
  bias_score NUMERIC,
  ethical_flags TEXT[],
  explanation JSONB,
  reviewer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ethics_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  jurisdiction TEXT NOT NULL,
  cert_level TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ethics_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES public.ai_decision_logs(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'appealed')),
  reviewer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Extend federation_policies for data sovereignty
ALTER TABLE public.federation_policies 
ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'public' CHECK (data_classification IN ('public', 'restricted', 'confidential')),
ADD COLUMN IF NOT EXISTS jurisdiction TEXT;

-- Seed SDG Mappings
INSERT INTO public.sdg_mappings (division_key, sdg_goal, sdg_target, indicator, metric_source) VALUES
('finance', 1, '1.1', 'Poverty rate reduction', 'World Bank'),
('finance', 8, '8.1', 'Economic growth rate', 'IMF'),
('finance', 10, '10.1', 'Income inequality', 'OECD'),
('energy', 7, '7.1', 'Access to electricity', 'OWID'),
('energy', 7, '7.2', 'Renewable energy share', 'IEA'),
('energy', 13, '13.2', 'Climate action integration', 'UNFCCC'),
('food', 2, '2.1', 'Prevalence of undernourishment', 'FAO'),
('food', 2, '2.4', 'Sustainable agriculture', 'FAOSTAT'),
('food', 12, '12.3', 'Food waste reduction', 'UNEP'),
('health', 3, '3.1', 'Maternal mortality', 'WHO'),
('health', 3, '3.3', 'Communicable diseases', 'WHO'),
('health', 3, '3.8', 'Universal health coverage', 'OWID Health'),
('defense', 16, '16.1', 'Reduce violence', 'UNODC'),
('defense', 16, '16.4', 'Illicit financial flows', 'FATF'),
('governance', 16, '16.5', 'Reduce corruption', 'Transparency Intl'),
('governance', 16, '16.6', 'Effective institutions', 'World Bank'),
('diplomacy', 17, '17.1', 'Revenue mobilization', 'UN'),
('diplomacy', 17, '17.16', 'Global partnership', 'GDELT'),
('crisis', 1, '1.5', 'Disaster resilience', 'UNDRR'),
('crisis', 11, '11.5', 'Disaster risk reduction', 'ReliefWeb'),
('crisis', 13, '13.1', 'Climate adaptation', 'IPCC'),
('logistics', 9, '9.1', 'Infrastructure development', 'World Bank'),
('logistics', 11, '11.2', 'Sustainable transport', 'OpenTraffic'),
('education', 4, '4.1', 'Primary education completion', 'UNESCO'),
('education', 4, '4.3', 'Technical education access', 'UNESCO UIS'),
('education', 4, '4.7', 'Sustainable development education', 'UNESCO')
ON CONFLICT DO NOTHING;

-- Seed Data Retention Policies
INSERT INTO public.data_retention_policies (category, max_days, auto_delete) VALUES
('ai_decision_logs', 180, true),
('system_logs', 365, true),
('health_data', 730, false),
('financial_metrics', 365, false),
('user_consent', 2555, false)
ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE public.user_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdg_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdg_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ethics_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ethics_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consent" ON public.user_consent
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent" ON public.user_consent
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view retention policies" ON public.data_retention_policies
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "SDG mappings viewable by authenticated users" ON public.sdg_mappings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "SDG progress viewable by authenticated users" ON public.sdg_progress
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert SDG progress" ON public.sdg_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update SDG progress" ON public.sdg_progress
  FOR UPDATE USING (true);

CREATE POLICY "AI decision logs viewable by admins and ethics officers" ON public.ai_decision_logs
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') OR 
    EXISTS (SELECT 1 FROM public.ethics_reviewers WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert AI decision logs" ON public.ai_decision_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Ethics reviewers can view all ethics cases" ON public.ethics_cases
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') OR 
    EXISTS (SELECT 1 FROM public.ethics_reviewers WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create ethics cases" ON public.ethics_cases
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Ethics reviewers can update cases" ON public.ethics_cases
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.ethics_reviewers WHERE user_id = auth.uid())
  );