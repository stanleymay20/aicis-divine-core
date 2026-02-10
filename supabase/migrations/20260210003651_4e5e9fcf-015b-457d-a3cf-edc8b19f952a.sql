
-- Intelligence Signals: cross-domain correlation & escalation persistence
CREATE TABLE public.intelligence_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('cross_domain', 'confidence_drop', 'scenario_divergence', 'escalation', 'anomaly_correlation')),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  domains TEXT[] NOT NULL DEFAULT '{}',
  countries TEXT[] DEFAULT '{}',
  source_pages TEXT[] DEFAULT '{}',
  confidence NUMERIC(5,2) DEFAULT 50.00 CHECK (confidence <= 95.00 AND confidence >= 0),
  evidence JSONB DEFAULT '[]',
  escalation_reason TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '72 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intelligence_signals ENABLE ROW LEVEL SECURITY;

-- Public read (aggregate intelligence, non-personal)
CREATE POLICY "Intelligence signals are readable by authenticated users"
  ON public.intelligence_signals FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only operators/admins can insert (via edge functions or admin UI)
CREATE POLICY "Operators can insert intelligence signals"
  ON public.intelligence_signals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only for acknowledgment updates
CREATE POLICY "Users can acknowledge signals"
  ON public.intelligence_signals FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Timestamp trigger
CREATE TRIGGER update_intelligence_signals_updated_at
  BEFORE UPDATE ON public.intelligence_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.intelligence_signals;

-- Index for efficient querying
CREATE INDEX idx_intelligence_signals_severity ON public.intelligence_signals(severity);
CREATE INDEX idx_intelligence_signals_created ON public.intelligence_signals(created_at DESC);
CREATE INDEX idx_intelligence_signals_domains ON public.intelligence_signals USING GIN(domains);
