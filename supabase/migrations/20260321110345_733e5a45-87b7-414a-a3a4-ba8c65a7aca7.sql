-- Fix security definer views by making them security invoker
ALTER VIEW public.organizations_safe_view SET (security_invoker = on);
ALTER VIEW public.accountability_nodes_public SET (security_invoker = on);