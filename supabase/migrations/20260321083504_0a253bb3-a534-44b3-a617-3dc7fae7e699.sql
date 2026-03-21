-- Optimized RPC for intelligence score computation (avoids 1000-row API limit)
CREATE OR REPLACE FUNCTION compute_intelligence_score_v2(_window_days int DEFAULT 30, _change_threshold numeric DEFAULT 1.5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  v_total bigint;
  v_change_total bigint;
  v_change_hits bigint;
  v_break_total bigint;
  v_break_hits bigint;
  v_tp_accuracy numeric;
  v_break_score numeric;
  v_change_pct numeric;
  v_mae_during_change numeric;
  v_grade text;
  v_cutoff date;
BEGIN
  v_cutoff := CURRENT_DATE - _window_days;

  SELECT COUNT(*) INTO v_total
  FROM forecast_validation_results WHERE realized_date >= v_cutoff;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE direction_hit)
  INTO v_change_total, v_change_hits
  FROM forecast_validation_results
  WHERE realized_date >= v_cutoff AND actual_direction != 'stable';

  SELECT COUNT(*), COUNT(*) FILTER (WHERE direction_hit)
  INTO v_break_total, v_break_hits
  FROM forecast_validation_results
  WHERE realized_date >= v_cutoff AND ABS(actual_value - predicted_value) > _change_threshold;

  SELECT COALESCE(AVG(absolute_error), 0) INTO v_mae_during_change
  FROM forecast_validation_results
  WHERE realized_date >= v_cutoff AND actual_direction != 'stable';

  v_tp_accuracy := CASE WHEN v_change_total > 0 THEN ROUND(v_change_hits::numeric / v_change_total * 100, 1) ELSE 0 END;
  v_break_score := CASE WHEN v_break_total > 0 THEN ROUND(v_break_hits::numeric / v_break_total * 100, 1) ELSE 0 END;
  v_change_pct := CASE WHEN v_total > 0 THEN ROUND(v_change_total::numeric / v_total * 100, 2) ELSE 0 END;

  v_grade := CASE
    WHEN v_tp_accuracy >= 60 THEN 'ANTICIPATING'
    WHEN v_tp_accuracy >= 40 THEN 'PREDICTING'
    WHEN v_tp_accuracy >= 20 THEN 'DETECTING'
    ELSE 'SENSING'
  END;

  result := jsonb_build_object(
    'turning_point_accuracy', v_tp_accuracy,
    'turning_point_total', v_change_total,
    'turning_point_hits', v_change_hits,
    'naive_turning_point_accuracy', 0,
    'break_detection_score', v_break_score,
    'break_detection_total', v_break_total,
    'break_detection_hits', v_break_hits,
    'filtered_aicis_accuracy', v_tp_accuracy,
    'filtered_naive_accuracy', 0,
    'filtered_delta', v_tp_accuracy,
    'intelligence_grade', v_grade,
    'mae_during_change', ROUND(v_mae_during_change::numeric, 2),
    'total_forecasts', v_total,
    'change_period_pct', v_change_pct
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
    v_tp_accuracy, v_change_total::int, v_change_hits::int, 0,
    v_break_score, v_break_total::int, v_break_hits::int,
    v_tp_accuracy, 0, v_tp_accuracy,
    v_grade, _window_days, v_total::int,
    v_change_pct, result
  );

  RETURN result;
END;
$$;