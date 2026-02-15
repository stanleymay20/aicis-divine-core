
-- Fix remaining permissive RLS policies: restrict write-only policies to service_role
-- These policies are named "Service role can..." but are actually open to all authenticated users

-- country_profiles UPDATE
DROP POLICY IF EXISTS "Service role can update country profiles" ON public.country_profiles;
CREATE POLICY "Service role can update country profiles" ON public.country_profiles FOR UPDATE TO service_role USING (true);

-- objective_tasks UPDATE
DROP POLICY IF EXISTS "Service role can update tasks" ON public.objective_tasks;
CREATE POLICY "Service role can update tasks" ON public.objective_tasks FOR UPDATE TO service_role USING (true);

-- sdg_progress UPDATE
DROP POLICY IF EXISTS "Service role can update SDG progress" ON public.sdg_progress;
CREATE POLICY "Service role can update SDG progress" ON public.sdg_progress FOR UPDATE TO service_role USING (true);

-- All remaining INSERT policies: drop and re-create with TO service_role
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'INSERT'
      AND policyname LIKE 'Service role can insert%'
      AND with_check = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO service_role WITH CHECK (true)',
      pol.policyname, pol.tablename
    );
  END LOOP;
END $$;
