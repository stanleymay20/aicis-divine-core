
-- AICIS Institutional Hardening: Row Ownership + Indexes + Flags

-- 1. Add created_by columns
ALTER TABLE public.anomaly_detections ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.crisis_events ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.ai_decision_logs ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 2. Partial indexes
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged 
  ON public.alerts (severity, created_at DESC) 
  WHERE acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_crisis_events_active 
  ON public.crisis_events (severity DESC, opened_at DESC) 
  WHERE status = 'active';

-- 3. anomaly_detections row ownership
DROP POLICY IF EXISTS "Operators can manage anomaly_detections" ON public.anomaly_detections;
DROP POLICY IF EXISTS "Operators can update own anomalies" ON public.anomaly_detections;
DROP POLICY IF EXISTS "Operators can delete own anomalies" ON public.anomaly_detections;

CREATE POLICY "Operators can update own anomalies"
  ON public.anomaly_detections FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can delete own anomalies"
  ON public.anomaly_detections FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. crisis_events row ownership
DROP POLICY IF EXISTS "Operators can manage crisis_events" ON public.crisis_events;
DROP POLICY IF EXISTS "Operators can update own crisis_events" ON public.crisis_events;
DROP POLICY IF EXISTS "Operators can delete own crisis_events" ON public.crisis_events;

CREATE POLICY "Operators can update own crisis_events"
  ON public.crisis_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can delete own crisis_events"
  ON public.crisis_events FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 5. approvals row ownership (requester is uuid)
DROP POLICY IF EXISTS "Operators can manage approvals" ON public.approvals;
DROP POLICY IF EXISTS "Users can update own approvals" ON public.approvals;

CREATE POLICY "Users can update own approvals"
  ON public.approvals FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR requester = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6. Seed system_flags
INSERT INTO public.system_flags (flag_key, enabled, description) VALUES
  ('use_v2_engine', true, 'Use Performance Engine V2 for all calculations'),
  ('enable_structural_break_detection', true, 'Enable CUSUM structural break detection'),
  ('enable_fragility_model', true, 'Enable nonlinear systemic fragility model'),
  ('enable_fan_charts', true, 'Show 80%/95% uncertainty bands on forecasts'),
  ('enable_signal_prioritization', true, 'Enable materiality-based alert prioritization')
ON CONFLICT (flag_key) DO NOTHING;
