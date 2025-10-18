-- Strategic objectives issued by human or AI
CREATE TABLE IF NOT EXISTS public.objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  objective_text TEXT NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','executing','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  ai_plan JSONB,
  ai_summary TEXT
);

-- Tasks automatically generated from objectives
CREATE TABLE IF NOT EXISTS public.objective_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID REFERENCES public.objectives(id) ON DELETE CASCADE,
  division TEXT,
  action TEXT,
  function_name TEXT,
  parameters JSONB,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','done','error','skipped')),
  output_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning record for self-improvement
CREATE TABLE IF NOT EXISTS public.ai_learning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT,
  record_id UUID,
  insight TEXT,
  success BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on objectives
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Objectives viewable by authenticated users"
ON public.objectives FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own objectives"
ON public.objectives FOR INSERT
WITH CHECK (auth.uid() = issued_by);

CREATE POLICY "Admins and operators can update objectives"
ON public.objectives FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Enable RLS on objective_tasks
ALTER TABLE public.objective_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable by authenticated users"
ON public.objective_tasks FOR SELECT
USING (true);

CREATE POLICY "System can insert tasks"
ON public.objective_tasks FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update tasks"
ON public.objective_tasks FOR UPDATE
USING (true);

-- Enable RLS on ai_learning_log
ALTER TABLE public.ai_learning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI learning log viewable by admins"
ON public.ai_learning_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert learning log"
ON public.ai_learning_log FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_objectives_status ON public.objectives(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objective_tasks_status ON public.objective_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_objective_tasks_objective_id ON public.objective_tasks(objective_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_log_created ON public.ai_learning_log(created_at DESC);