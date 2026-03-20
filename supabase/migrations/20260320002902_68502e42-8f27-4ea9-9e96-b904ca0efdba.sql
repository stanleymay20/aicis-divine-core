-- Track village seeding attempts so we don't infinitely retry countries where Overpass has no data
CREATE TABLE IF NOT EXISTS public.village_seed_attempts (
  country_iso3 text PRIMARY KEY,
  attempted_at timestamptz DEFAULT now(),
  villages_found int DEFAULT 0,
  status text DEFAULT 'completed'
);

ALTER TABLE public.village_seed_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.village_seed_attempts FOR SELECT TO anon, authenticated USING (true);

-- Update the RPC to exclude already-attempted countries
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
    AND NOT EXISTS (
      SELECT 1 FROM village_seed_attempts vsa
      WHERE vsa.country_iso3 = ar.country_iso3
    )
  ORDER BY ar.country_iso3;
$$;