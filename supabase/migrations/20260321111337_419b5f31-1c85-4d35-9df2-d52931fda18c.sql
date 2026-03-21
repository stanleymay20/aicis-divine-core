-- Add 'dormant' to pipeline_health status options
ALTER TABLE pipeline_health DROP CONSTRAINT pipeline_health_status_check;
ALTER TABLE pipeline_health ADD CONSTRAINT pipeline_health_status_check 
  CHECK (status = ANY (ARRAY['healthy', 'degraded', 'failing', 'stale', 'disabled', 'dormant']));