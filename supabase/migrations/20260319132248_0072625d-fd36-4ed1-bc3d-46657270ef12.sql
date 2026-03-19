
-- Sub-national administrative regions hierarchy
CREATE TABLE public.admin_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  admin_level SMALLINT NOT NULL CHECK (admin_level BETWEEN 0 AND 5),
  -- 0=country, 1=state/province, 2=district, 3=sub-district, 4=village/settlement
  parent_id UUID REFERENCES public.admin_regions(id),
  country_iso3 TEXT NOT NULL,
  iso_code TEXT, -- ISO 3166-2 for admin level 1
  osm_id BIGINT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  bbox JSONB,
  population_est BIGINT,
  area_km2 DOUBLE PRECISION,
  urban_rural TEXT CHECK (urban_rural IN ('urban', 'rural', 'peri-urban', 'unknown')),
  source TEXT DEFAULT 'osm',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_regions_parent ON public.admin_regions(parent_id);
CREATE INDEX idx_admin_regions_country ON public.admin_regions(country_iso3);
CREATE INDEX idx_admin_regions_level ON public.admin_regions(admin_level);
CREATE INDEX idx_admin_regions_coords ON public.admin_regions(lat, lon);
CREATE UNIQUE INDEX idx_admin_regions_osm ON public.admin_regions(osm_id) WHERE osm_id IS NOT NULL;

-- Village/settlement-level indicators (the micro intelligence layer)
CREATE TABLE public.village_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.admin_regions(id) ON DELETE CASCADE,
  domain TEXT NOT NULL, -- health, economy, infrastructure, environment, education, security
  indicator TEXT NOT NULL,
  value DOUBLE PRECISION,
  unit TEXT,
  confidence DOUBLE PRECISION DEFAULT 0.5, -- 0-1, lower for satellite-inferred
  data_source TEXT NOT NULL, -- 'satellite_inference', 'dhs_survey', 'acled', 'osm', 'census'
  inference_model TEXT, -- which AI model generated the estimate
  observed_at TIMESTAMPTZ DEFAULT now(),
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_village_indicators_region ON public.village_indicators(region_id);
CREATE INDEX idx_village_indicators_domain ON public.village_indicators(domain);
CREATE INDEX idx_village_indicators_observed ON public.village_indicators(observed_at DESC);

-- Satellite observation tiles linked to regions
CREATE TABLE public.satellite_tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES public.admin_regions(id),
  tile_x INT NOT NULL,
  tile_y INT NOT NULL,
  zoom_level SMALLINT NOT NULL DEFAULT 12,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lon DOUBLE PRECISION NOT NULL,
  ndvi DOUBLE PRECISION, -- vegetation index
  nightlight_radiance DOUBLE PRECISION, -- economic proxy
  built_area_pct DOUBLE PRECISION, -- urbanization proxy
  water_body_pct DOUBLE PRECISION,
  cloud_cover_pct DOUBLE PRECISION,
  observation_date DATE NOT NULL,
  satellite_source TEXT DEFAULT 'sentinel-2',
  raw_bands JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_satellite_tiles_region ON public.satellite_tiles(region_id);
CREATE INDEX idx_satellite_tiles_coords ON public.satellite_tiles(center_lat, center_lon);
CREATE INDEX idx_satellite_tiles_date ON public.satellite_tiles(observation_date DESC);
CREATE UNIQUE INDEX idx_satellite_tiles_unique ON public.satellite_tiles(tile_x, tile_y, zoom_level, observation_date);

-- RLS policies (service role writes, authenticated reads)
ALTER TABLE public.admin_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.village_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satellite_tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read admin_regions" ON public.admin_regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read village_indicators" ON public.village_indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read satellite_tiles" ON public.satellite_tiles FOR SELECT TO authenticated USING (true);

-- RPC to get full hierarchy for a country
CREATE OR REPLACE FUNCTION public.get_region_hierarchy(_country_iso3 TEXT, _max_level SMALLINT DEFAULT 4)
RETURNS TABLE(
  id UUID, name TEXT, admin_level SMALLINT, parent_id UUID,
  lat DOUBLE PRECISION, lon DOUBLE PRECISION,
  population_est BIGINT, urban_rural TEXT, indicator_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT
    ar.id, ar.name, ar.admin_level, ar.parent_id,
    ar.lat, ar.lon, ar.population_est, ar.urban_rural,
    (SELECT COUNT(*) FROM village_indicators vi WHERE vi.region_id = ar.id) AS indicator_count
  FROM admin_regions ar
  WHERE ar.country_iso3 = _country_iso3
    AND ar.admin_level <= _max_level
  ORDER BY ar.admin_level, ar.name;
$$;

-- RPC to get village indicators with parent context
CREATE OR REPLACE FUNCTION public.get_village_dashboard(_region_id UUID)
RETURNS TABLE(
  domain TEXT, indicator TEXT, value DOUBLE PRECISION,
  unit TEXT, confidence DOUBLE PRECISION, data_source TEXT,
  observed_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT domain, indicator, value, unit, confidence, data_source, observed_at
  FROM village_indicators
  WHERE region_id = _region_id
  ORDER BY domain, indicator, observed_at DESC;
$$;
