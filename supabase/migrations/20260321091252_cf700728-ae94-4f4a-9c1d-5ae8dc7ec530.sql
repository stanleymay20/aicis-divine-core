-- Microdata source registry for tracking licensed public-use datasets
CREATE TABLE public.microdata_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  provider text NOT NULL,
  dataset_id text NOT NULL,
  title text NOT NULL,
  description text,
  license_type text NOT NULL,
  license_url text,
  countries text[] DEFAULT '{}',
  years int[] DEFAULT '{}',
  domains text[] DEFAULT '{}',
  deidentification_status text NOT NULL DEFAULT 'unknown',
  aggregation_level text NOT NULL DEFAULT 'individual',
  ingested_at timestamptz,
  record_count bigint DEFAULT 0,
  indicator_count int DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'registered',
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, dataset_id)
);

CREATE TABLE public.microdata_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES microdata_sources(id) ON DELETE CASCADE NOT NULL,
  country_iso3 text NOT NULL,
  region_name text,
  domain text NOT NULL,
  indicator text NOT NULL,
  value double precision NOT NULL,
  unit text,
  year int NOT NULL,
  sample_size int,
  confidence_interval jsonb,
  aggregation_method text DEFAULT 'mean',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_microdata_indicators_country ON microdata_indicators(country_iso3);
CREATE INDEX idx_microdata_indicators_domain ON microdata_indicators(domain);
CREATE INDEX idx_microdata_indicators_source ON microdata_indicators(source_id);

ALTER TABLE microdata_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE microdata_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read microdata_sources" ON microdata_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read microdata_indicators" ON microdata_indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service write microdata_sources" ON microdata_sources FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service write microdata_indicators" ON microdata_indicators FOR ALL TO service_role USING (true) WITH CHECK (true);