
CREATE OR REPLACE FUNCTION public.aggregate_country_snapshots(_snapshot_date date)
RETURNS TABLE (
  iso3 text,
  avg_risk numeric,
  avg_momentum numeric,
  avg_fragility numeric,
  avg_performance numeric,
  avg_confidence numeric,
  total_breaks bigint,
  domains_down bigint,
  domains_up bigint,
  domain_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cps.iso3,
    ROUND(AVG(cps.risk_pressure_score)::numeric, 1) AS avg_risk,
    ROUND(AVG(cps.momentum_score)::numeric, 1) AS avg_momentum,
    ROUND(AVG(cps.systemic_fragility_score)::numeric, 1) AS avg_fragility,
    ROUND(AVG(cps.performance_index)::numeric, 1) AS avg_performance,
    ROUND(AVG(cps.confidence_score)::numeric, 1) AS avg_confidence,
    SUM(cps.structural_break_count) AS total_breaks,
    COUNT(*) FILTER (WHERE cps.forecast_direction = 'down') AS domains_down,
    COUNT(*) FILTER (WHERE cps.forecast_direction = 'up') AS domains_up,
    COUNT(*) AS domain_count
  FROM country_performance_snapshots cps
  WHERE cps.snapshot_date = _snapshot_date
  GROUP BY cps.iso3
  ORDER BY cps.iso3;
$$;
