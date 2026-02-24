
CREATE OR REPLACE VIEW public.daily_accumulation AS
SELECT
  'snapshots' as metric,
  DATE(snapshot_date) as day,
  COUNT(*) as count
FROM country_performance_snapshots
GROUP BY DATE(snapshot_date)

UNION ALL

SELECT
  'forecasts',
  DATE(created_at),
  COUNT(*)
FROM forecast_archive
GROUP BY DATE(created_at)

UNION ALL

SELECT
  'calibration',
  DATE(computed_at),
  COUNT(*)
FROM calibration_metrics
GROUP BY DATE(computed_at)

UNION ALL

SELECT
  'vulnerability',
  DATE(created_at),
  COUNT(*)
FROM vulnerability_scores
GROUP BY DATE(created_at);
