
-- Fix new view to use security invoker
ALTER VIEW public.action_reliability_view SET (security_invoker = on);
