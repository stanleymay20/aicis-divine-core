CREATE OR REPLACE FUNCTION public.get_districts_needing_settlements(_limit int DEFAULT 50)
RETURNS TABLE(id uuid, name text, admin_level smallint, lat double precision, lon double precision, country_iso3 text, population_est bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ar.id, ar.name, ar.admin_level, ar.lat, ar.lon, ar.country_iso3, ar.population_est
  FROM admin_regions ar
  WHERE ar.admin_level IN (1, 2)
    AND ar.lat IS NOT NULL
    AND ar.lon IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM admin_regions child
      WHERE child.parent_id = ar.id
        AND child.admin_level >= 3
    )
  ORDER BY ar.country_iso3, ar.id
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.count_districts_needing_settlements()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)
  FROM admin_regions ar
  WHERE ar.admin_level IN (1, 2)
    AND ar.lat IS NOT NULL
    AND ar.lon IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM admin_regions child
      WHERE child.parent_id = ar.id
        AND child.admin_level >= 3
    );
$$;