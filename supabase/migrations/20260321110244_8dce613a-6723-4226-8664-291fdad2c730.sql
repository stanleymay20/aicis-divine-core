-- Add 'timeout' to allowed statuses
ALTER TABLE automation_logs DROP CONSTRAINT automation_logs_status_check;
ALTER TABLE automation_logs ADD CONSTRAINT automation_logs_status_check 
  CHECK (status = ANY (ARRAY['running', 'success', 'error', 'timeout']));

-- Auto-cleanup function for zombie jobs
CREATE OR REPLACE FUNCTION public.cleanup_zombie_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE automation_logs
  SET status = 'timeout',
      message = COALESCE(message, '') || ' [auto-timeout: stuck >1h]'
  WHERE status = 'running'
    AND executed_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Index for fast zombie detection
CREATE INDEX IF NOT EXISTS idx_automation_logs_running
ON automation_logs (status, executed_at)
WHERE status = 'running';