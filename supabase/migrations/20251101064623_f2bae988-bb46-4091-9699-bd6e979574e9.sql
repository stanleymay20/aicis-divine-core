-- Security incidents and critical alerts tables
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  event_type TEXT,
  severity NUMERIC,
  killed INTEGER,
  injured INTEGER,
  displaced INTEGER,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  country TEXT,
  iso2 TEXT,
  iso3 TEXT,
  admin1 TEXT,
  admin2 TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  url TEXT,
  raw JSONB,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.critical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('urgent','high','medium','low')),
  headline TEXT NOT NULL,
  incident_id UUID REFERENCES public.security_incidents(id) ON DELETE CASCADE,
  iso3 TEXT,
  country TEXT,
  event_type TEXT,
  severity NUMERIC,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  acknowledged BOOLEAN DEFAULT false,
  ack_by UUID,
  meta JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_si_time ON public.security_incidents(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_si_iso ON public.security_incidents(iso3);
CREATE UNIQUE INDEX IF NOT EXISTS u_si_dedupe ON public.security_incidents(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_ca_time ON public.critical_alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ca_level ON public.critical_alerts(level);

-- RLS
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "r_si" ON public.security_incidents FOR SELECT USING (true);
CREATE POLICY "r_ca" ON public.critical_alerts FOR SELECT USING (true);
CREATE POLICY "w_si_sys" ON public.security_incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "w_ca_sys" ON public.critical_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "u_ca_ack" ON public.critical_alerts FOR UPDATE USING (auth.uid() IS NOT NULL);