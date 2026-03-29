
-- Remove overly permissive model_registry UPDATE policy
DROP POLICY IF EXISTS "model_registry_update" ON public.model_registry;
