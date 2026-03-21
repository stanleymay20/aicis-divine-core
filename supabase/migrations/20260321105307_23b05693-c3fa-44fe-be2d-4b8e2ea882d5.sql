
-- Fix security definer view: daily_accumulation
DROP VIEW IF EXISTS public.daily_accumulation;
CREATE VIEW public.daily_accumulation
WITH (security_invoker = on) AS
  SELECT 'snapshots'::text AS metric,
    country_performance_snapshots.snapshot_date AS day,
    count(*) AS count
   FROM country_performance_snapshots
  GROUP BY country_performance_snapshots.snapshot_date
UNION ALL
 SELECT 'forecasts'::text AS metric,
    date(forecast_archive.created_at) AS day,
    count(*) AS count
   FROM forecast_archive
  GROUP BY (date(forecast_archive.created_at))
UNION ALL
 SELECT 'calibration'::text AS metric,
    date(calibration_metrics.computed_at) AS day,
    count(*) AS count
   FROM calibration_metrics
  GROUP BY (date(calibration_metrics.computed_at))
UNION ALL
 SELECT 'vulnerability'::text AS metric,
    date(vulnerability_scores.created_at) AS day,
    count(*) AS count
   FROM vulnerability_scores
  GROUP BY (date(vulnerability_scores.created_at));
