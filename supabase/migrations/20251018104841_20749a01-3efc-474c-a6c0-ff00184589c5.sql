-- Phase 6: Inter-Division Data Bus & Intelligence Core

-- Intel events for cross-division communication
CREATE TABLE IF NOT EXISTS public.intel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL CHECK (division IN ('finance', 'energy', 'health', 'food', 'governance', 'defense', 'diplomacy', 'crisis', 'system')),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  title TEXT NOT NULL,
  description TEXT,
  payload JSONB,
  source_system TEXT,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intel_events_division ON public.intel_events(division);
CREATE INDEX IF NOT EXISTS idx_intel_events_severity ON public.intel_events(severity);
CREATE INDEX IF NOT EXISTS idx_intel_events_published_at ON public.intel_events(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_events_event_type ON public.intel_events(event_type);

ALTER TABLE public.intel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intel events viewable by authenticated users"
  ON public.intel_events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can publish intel events"
  ON public.intel_events FOR INSERT
  WITH CHECK (auth.uid() = published_by);

-- Enable realtime for intel events
ALTER PUBLICATION supabase_realtime ADD TABLE public.intel_events;

-- Intelligence index for cross-division summaries
CREATE TABLE IF NOT EXISTS public.intelligence_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_type TEXT NOT NULL CHECK (index_type IN ('global_status', 'risk_assessment', 'opportunity', 'threat', 'anomaly')),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  title TEXT NOT NULL,
  summary_md TEXT NOT NULL,
  affected_divisions TEXT[] NOT NULL,
  metrics JSONB,
  recommendations_md TEXT,
  confidence_score NUMERIC(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_index_type ON public.intelligence_index(index_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_index_priority ON public.intelligence_index(priority DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_index_generated_at ON public.intelligence_index(generated_at DESC);

ALTER TABLE public.intelligence_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intelligence index viewable by authenticated users"
  ON public.intelligence_index FOR SELECT
  USING (true);

CREATE POLICY "Admins and operators can manage intelligence index"
  ON public.intelligence_index FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Anomaly detections across divisions
CREATE TABLE IF NOT EXISTS public.anomaly_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  metrics JSONB NOT NULL,
  baseline_metrics JSONB,
  deviation_percentage NUMERIC(10,2),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'false_positive')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_detections_division ON public.anomaly_detections(division);
CREATE INDEX IF NOT EXISTS idx_anomaly_detections_severity ON public.anomaly_detections(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_detections_status ON public.anomaly_detections(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_detections_detected_at ON public.anomaly_detections(detected_at DESC);

ALTER TABLE public.anomaly_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anomaly detections viewable by authenticated users"
  ON public.anomaly_detections FOR SELECT
  USING (true);

CREATE POLICY "Admins and operators can manage anomaly detections"
  ON public.anomaly_detections FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Risk predictions
CREATE TABLE IF NOT EXISTS public.risk_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type TEXT NOT NULL,
  affected_divisions TEXT[] NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  probability NUMERIC(5,2) CHECK (probability >= 0 AND probability <= 100),
  impact_score NUMERIC(5,2) CHECK (impact_score >= 0 AND impact_score <= 100),
  title TEXT NOT NULL,
  description_md TEXT NOT NULL,
  indicators JSONB,
  mitigation_strategies_md TEXT,
  predicted_timeframe TEXT,
  confidence_level NUMERIC(5,2) CHECK (confidence_level >= 0 AND confidence_level <= 100),
  model_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_predictions_risk_level ON public.risk_predictions(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_probability ON public.risk_predictions(probability DESC);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_created_at ON public.risk_predictions(created_at DESC);

ALTER TABLE public.risk_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Risk predictions viewable by authenticated users"
  ON public.risk_predictions FOR SELECT
  USING (true);

CREATE POLICY "Admins and operators can manage risk predictions"
  ON public.risk_predictions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Compliance audit trail
CREATE TABLE IF NOT EXISTS public.compliance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  division TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_description TEXT NOT NULL,
  compliance_status TEXT NOT NULL CHECK (compliance_status IN ('compliant', 'warning', 'violation')),
  data_accessed JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_user_id ON public.compliance_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_compliance_status ON public.compliance_audit(compliance_status);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_created_at ON public.compliance_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_division ON public.compliance_audit(division);

ALTER TABLE public.compliance_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view compliance audit"
  ON public.compliance_audit FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert compliance audit"
  ON public.compliance_audit FOR INSERT
  WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_intelligence_index_updated_at
  BEFORE UPDATE ON public.intelligence_index
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_anomaly_detections_updated_at
  BEFORE UPDATE ON public.anomaly_detections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_risk_predictions_updated_at
  BEFORE UPDATE ON public.risk_predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();