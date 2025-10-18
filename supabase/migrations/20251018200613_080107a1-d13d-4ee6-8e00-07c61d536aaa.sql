-- Create automation_logs table
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','success','error')),
  message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all logs
CREATE POLICY "read_all_admin_only"
ON public.automation_logs FOR SELECT
USING (has_role(auth.uid(),'admin'::app_role));

-- Policy: System can insert logs
CREATE POLICY "insert_system_only"
ON public.automation_logs FOR INSERT
WITH CHECK (true);