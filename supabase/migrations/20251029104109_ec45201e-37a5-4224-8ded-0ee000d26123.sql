-- Enable pg_cron for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule global intelligence collection every 6 hours
SELECT cron.schedule(
  'global-intelligence-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://psonnnuhjjskrdazrakk.supabase.co/functions/v1/cron-global-intelligence',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb25ubnVoampza3JkYXpyYWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2OTU0NzAsImV4cCI6MjA3NTI3MTQ3MH0.7ZqxEzVc9mVLJrbI5HgesAmKaHWlNt9oB4lZta_in6o"}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule nightly AI training at 2 AM
SELECT cron.schedule(
  'train-global-model-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://psonnnuhjjskrdazrakk.supabase.co/functions/v1/train-global-model',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb25ubnVoampza3JkYXpyYWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2OTU0NzAsImV4cCI6MjA3NTI3MTQ3MH0.7ZqxEzVc9mVLJrbI5HgesAmKaHWlNt9oB4lZta_in6o"}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule weekly data integrity audit
SELECT cron.schedule(
  'data-integrity-weekly',
  '0 0 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://psonnnuhjjskrdazrakk.supabase.co/functions/v1/analyze-global-status',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb25ubnVoampza3JkYXpyYWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2OTU0NzAsImV4cCI6MjA3NTI3MTQ3MH0.7ZqxEzVc9mVLJrbI5HgesAmKaHWlNt9oB4lZta_in6o"}'::jsonb
  ) AS request_id;
  $$
);