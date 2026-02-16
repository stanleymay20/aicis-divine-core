
-- Fix security definer view by setting security_invoker
ALTER VIEW public.accountability_nodes_public SET (security_invoker = on);
