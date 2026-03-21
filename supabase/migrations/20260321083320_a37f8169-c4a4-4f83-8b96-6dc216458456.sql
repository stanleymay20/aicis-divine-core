-- True Intelligence Score: metrics that matter for an early-warning system

-- Table to store intelligence-grade evaluation metrics
CREATE TABLE IF NOT EXISTS intelligence_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Core Intelligence Metrics
  turning_point_accuracy numeric DEFAULT 0,        -- % of actual changes AICIS predicted
  turning_point_total int DEFAULT 0,               -- total actual direction changes
  turning_point_hits int DEFAULT 0,                 -- AICIS caught these
  
  naive_turning_point_accuracy numeric DEFAULT 0,   -- naive always says "stable" → 0% during changes
  
  break_detection_score numeric DEFAULT 0,          -- accuracy only during |change| > threshold
  break_detection_total int DEFAULT 0,
  break_detection_hits int DEFAULT 0,
  
  lead_time_advantage_days numeric DEFAULT 0,       -- avg days AICIS signaled before reality
  volatility_sensitivity numeric DEFAULT 0,         -- correlation between predicted volatility and actual
  
  -- Filtered accuracy (excluding stable periods)
  filtered_aicis_accuracy numeric DEFAULT 0,
  filtered_naive_accuracy numeric DEFAULT 0,
  filtered_delta numeric DEFAULT 0,                 -- THIS is the real score
  
  -- Overall intelligence grade
  intelligence_grade text DEFAULT 'SENSING',        -- SENSING → DETECTING → PREDICTING → ANTICIPATING
  
  -- Context
  evaluation_window_days int DEFAULT 30,
  total_forecasts_evaluated int DEFAULT 0,
  change_period_pct numeric DEFAULT 0,              -- % of periods with actual movement
  
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_intelligence_score_date ON intelligence_score_snapshots(snapshot_date DESC);

-- RPC to compute the True Intelligence Score
CREATE OR REPLACE FUNCTION compute_intelligence_score(_window_days int DEFAULT 30, _change_threshold numeric DEFAULT 1.5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  v_total int;
  v_change_total int;
  v_change_hits int;
  v_break_total int;
  v_break_hits int;
  v_naive_change_hits int;
  v_tp_accuracy numeric;
  v_naive_tp_accuracy numeric;
  v_break_score numeric;
  v_filtered_aicis numeric;
  v_filtered_naive numeric;
  v_grade text;
BEGIN
  -- Total forecasts in window
  SELECT COUNT(*) INTO v_total
  FROM forecast_validation_results
  WHERE realized_date >= (CURRENT_DATE - _window_days);

  -- Turning point detection: actual_direction != 'stable'
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE direction_hit)
  INTO v_change_total, v_change_hits
  FROM forecast_validation_results
  WHERE realized_date >= (CURRENT_DATE - _window_days)
    AND actual_direction != 'stable';

  -- Naive always predicts "stable", so it NEVER catches turning points
  v_naive_change_hits := 0;

  -- Break detection: only significant moves (|error| > threshold or |actual - predicted| > threshold)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE direction_hit)
  INTO v_break_total, v_break_hits
  FROM forecast_validation_results
  WHERE realized_date >= (CURRENT_DATE - _window_days)
    AND ABS(actual_value - predicted_value) > _change_threshold;

  -- Compute percentages safely
  v_tp_accuracy := CASE WHEN v_change_total > 0 THEN ROUND(v_change_hits::numeric / v_change_total * 100, 1) ELSE 0 END;
  v_naive_tp_accuracy := 0; -- naive never catches changes
  v_break_score := CASE WHEN v_break_total > 0 THEN ROUND(v_break_hits::numeric / v_break_total * 100, 1) ELSE 0 END;

  -- Filtered accuracy: only during change periods
  SELECT
    ROUND(AVG(CASE WHEN direction_hit THEN 1 ELSE 0 END) * 100, 1),
    ROUND(AVG(CASE WHEN actual_direction = 'stable' THEN 1 ELSE 0 END) * 100, 1)
  INTO v_filtered_aicis, v_filtered_naive
  FROM forecast_validation_results
  WHERE realized_date >= (CURRENT_DATE - _window_days)
    AND actual_direction != 'stable';

  -- Intelligence grade based on turning point accuracy
  v_grade := CASE
    WHEN v_tp_accuracy >= 60 THEN 'ANTICIPATING'
    WHEN v_tp_accuracy >= 40 THEN 'PREDICTING'
    WHEN v_tp_accuracy >= 20 THEN 'DETECTING'
    ELSE 'SENSING'
  END;

  -- Build result
  result := jsonb_build_object(
    'turning_point_accuracy', COALESCE(v_tp_accuracy, 0),
    'turning_point_total', v_change_total,
    'turning_point_hits', v_change_hits,
    'naive_turning_point_accuracy', v_naive_tp_accuracy,
    'break_detection_score', COALESCE(v_break_score, 0),
    'break_detection_total', v_break_total,
    'break_detection_hits', v_break_hits,
    'filtered_aicis_accuracy', COALESCE(v_filtered_aicis, 0),
    'filtered_naive_accuracy', COALESCE(v_filtered_naive, 0),
    'filtered_delta', COALESCE(v_filtered_aicis, 0) - COALESCE(v_filtered_naive, 0),
    'intelligence_grade', v_grade,
    'total_forecasts', v_total,
    'change_period_pct', CASE WHEN v_total > 0 THEN ROUND(v_change_total::numeric / v_total * 100, 2) ELSE 0 END
  );

  -- Store snapshot
  INSERT INTO intelligence_score_snapshots (
    turning_point_accuracy, turning_point_total, turning_point_hits,
    naive_turning_point_accuracy,
    break_detection_score, break_detection_total, break_detection_hits,
    filtered_aicis_accuracy, filtered_naive_accuracy, filtered_delta,
    intelligence_grade, evaluation_window_days, total_forecasts_evaluated,
    change_period_pct, metadata
  ) VALUES (
    v_tp_accuracy, v_change_total, v_change_hits,
    v_naive_tp_accuracy,
    v_break_score, v_break_total, v_break_hits,
    COALESCE(v_filtered_aicis, 0), COALESCE(v_filtered_naive, 0), 
    COALESCE(v_filtered_aicis, 0) - COALESCE(v_filtered_naive, 0),
    v_grade, _window_days, v_total,
    CASE WHEN v_total > 0 THEN ROUND(v_change_total::numeric / v_total * 100, 2) ELSE 0 END,
    result
  );

  RETURN result;
END;
$$;