-- Create economic_indicators table for Alpha Vantage data
CREATE TABLE IF NOT EXISTS public.economic_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_name TEXT NOT NULL,
  country TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  date DATE NOT NULL,
  source TEXT DEFAULT 'alpha_vantage',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create security_vulnerabilities table for NVD data
CREATE TABLE IF NOT EXISTS public.security_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id TEXT UNIQUE NOT NULL,
  description TEXT,
  severity TEXT NOT NULL,
  cvss_score NUMERIC,
  published_date TIMESTAMPTZ,
  last_modified TIMESTAMPTZ,
  affected_products TEXT[],
  reference_links JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.economic_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_vulnerabilities ENABLE ROW LEVEL SECURITY;

-- RLS policies for economic_indicators
CREATE POLICY "Economic indicators viewable by authenticated users"
  ON public.economic_indicators FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage economic indicators"
  ON public.economic_indicators FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for security_vulnerabilities
CREATE POLICY "Security vulnerabilities viewable by authenticated users"
  ON public.security_vulnerabilities FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage security vulnerabilities"
  ON public.security_vulnerabilities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_economic_indicators_country ON public.economic_indicators(country);
CREATE INDEX idx_economic_indicators_date ON public.economic_indicators(date DESC);
CREATE INDEX idx_security_vulnerabilities_severity ON public.security_vulnerabilities(severity);
CREATE INDEX idx_security_vulnerabilities_published ON public.security_vulnerabilities(published_date DESC);