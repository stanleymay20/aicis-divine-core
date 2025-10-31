-- Create dynamic geo catalog and normalized metrics schema

-- Geo catalog for dynamic location resolution
CREATE TABLE IF NOT EXISTS public.geo_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  iso2 TEXT,
  iso3 TEXT,
  fips TEXT,
  type TEXT CHECK (type IN ('country','region','city','suburb','district')),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  bbox DOUBLE PRECISION[], -- [minLon,minLat,maxLon,maxLat]
  source TEXT NOT NULL,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_catalog_iso3 ON public.geo_catalog(iso3);
CREATE INDEX IF NOT EXISTS idx_geo_catalog_name ON public.geo_catalog(name);
CREATE INDEX IF NOT EXISTS idx_geo_catalog_type ON public.geo_catalog(type);

-- Normalized metrics table
CREATE TABLE IF NOT EXISTS public.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  metric TEXT NOT NULL,
  geo_id UUID REFERENCES public.geo_catalog(id),
  iso3 TEXT,
  period TEXT,
  value DOUBLE PRECISION,
  unit TEXT,
  confidence DOUBLE PRECISION,
  source TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_domain ON public.metrics(domain);
CREATE INDEX IF NOT EXISTS idx_metrics_geo_id ON public.metrics(geo_id);
CREATE INDEX IF NOT EXISTS idx_metrics_period ON public.metrics(period);
CREATE INDEX IF NOT EXISTS idx_metrics_iso3 ON public.metrics(iso3);

-- Update vulnerability_scores to include more fields
ALTER TABLE public.vulnerability_scores 
ADD COLUMN IF NOT EXISTS climate_risk DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS governance_risk DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS data_sources JSONB;

-- Drop and recreate confidence check to allow proper constraint
ALTER TABLE public.vulnerability_scores DROP CONSTRAINT IF EXISTS vulnerability_scores_confidence_check;
ALTER TABLE public.vulnerability_scores 
ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION;
ALTER TABLE public.vulnerability_scores
ADD CONSTRAINT vulnerability_scores_confidence_check CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

-- RLS policies
ALTER TABLE public.geo_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all_geo" ON public.geo_catalog;
CREATE POLICY "read_all_geo" ON public.geo_catalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read_all_metrics" ON public.metrics;
CREATE POLICY "read_all_metrics" ON public.metrics FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_system_metrics" ON public.metrics;
CREATE POLICY "insert_system_metrics" ON public.metrics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "insert_system_geo" ON public.geo_catalog;
CREATE POLICY "insert_system_geo" ON public.geo_catalog FOR INSERT WITH CHECK (true);