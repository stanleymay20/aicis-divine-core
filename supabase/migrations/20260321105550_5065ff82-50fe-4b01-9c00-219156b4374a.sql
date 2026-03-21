
-- Fix organizations view with correct columns (exclude Stripe fields)
DROP VIEW IF EXISTS public.organizations_member_view;
CREATE VIEW public.organizations_member_view
WITH (security_invoker = on) AS
  SELECT id, name, owner_id, tier, status, feature_flags, billing_status, 
         trial_ends_at, created_at, updated_at, api_enabled, max_api_keys, 
         monthly_api_quota, white_label_enabled
  FROM public.organizations;
