
-- Clean up all zombie running jobs older than 10 minutes
UPDATE public.automation_logs 
SET status = 'timeout', message = COALESCE(message, '') || ' [auto-timeout: forensic audit cleanup]'
WHERE status = 'running' AND executed_at < NOW() - INTERVAL '10 minutes';
