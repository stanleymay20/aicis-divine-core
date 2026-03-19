CREATE OR REPLACE FUNCTION public.get_countries_needing_villages()
RETURNS TABLE(country_iso3 text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ar.country_iso3
  FROM admin_regions ar
  WHERE ar.admin_level = 0
    AND NOT EXISTS (
      SELECT 1 FROM admin_regions ar2 
      WHERE ar2.country_iso3 = ar.country_iso3 
        AND ar2.admin_level >= 3
    )
  ORDER BY ar.country_iso3;
$$;

CREATE OR REPLACE FUNCTION public.get_uncovered_regions(_limit int DEFAULT 10)
RETURNS TABLE(id uuid, name text, admin_level smallint, lat double precision, lon double precision, country_iso3 text, population_est bigint, urban_rural text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ar.id, ar.name, ar.admin_level, ar.lat, ar.lon, ar.country_iso3, ar.population_est, ar.urban_rural
  FROM admin_regions ar
  WHERE ar.lat IS NOT NULL AND ar.lon IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM village_indicators vi WHERE vi.region_id = ar.id
    )
  ORDER BY ar.admin_level, ar.id
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.count_uncovered_regions()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)
  FROM admin_regions ar
  WHERE ar.lat IS NOT NULL AND ar.lon IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM village_indicators vi WHERE vi.region_id = ar.id
    );
$$;