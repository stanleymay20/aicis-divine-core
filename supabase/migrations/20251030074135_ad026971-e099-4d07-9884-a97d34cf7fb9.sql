-- Phase 5: Global Alerts System
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title text NOT NULL,
  message text NOT NULL,
  division text NOT NULL,
  country text,
  metadata jsonb DEFAULT '{}',
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Phase 6: Predictive Intelligence
CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division text NOT NULL,
  country text NOT NULL,
  forecast jsonb NOT NULL,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  volatility_index numeric,
  predicted_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Policies for alerts
CREATE POLICY "Alerts viewable by authenticated users" 
  ON public.alerts FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert alerts" 
  ON public.alerts FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts" 
  ON public.alerts FOR UPDATE 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for predictions
CREATE POLICY "Predictions viewable by authenticated users" 
  ON public.predictions FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert predictions" 
  ON public.predictions FOR INSERT 
  WITH CHECK (true);

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity) WHERE NOT acknowledged;
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_division ON public.predictions(division, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_country ON public.predictions(country, predicted_at DESC);
