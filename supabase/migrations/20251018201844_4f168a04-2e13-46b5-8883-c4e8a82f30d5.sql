-- Phase 10.8: AI-Driven Crisis Governance (ai_mitigation_actions only)
CREATE TABLE IF NOT EXISTS public.ai_mitigation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crisis_id UUID REFERENCES public.crisis_events(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  parameters JSONB,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','executed','failed')),
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_mitigation_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_mitigation_actions
CREATE POLICY "Mitigation actions viewable by authenticated users"
ON public.ai_mitigation_actions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and operators can manage mitigation actions"
ON public.ai_mitigation_actions FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operator'::app_role));