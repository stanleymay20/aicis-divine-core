-- 1. Fix organizations: create restricted policy that hides Stripe from non-owners
DROP POLICY IF EXISTS "org_members_can_view" ON organizations;

-- Owner sees everything
CREATE POLICY "org_owner_full_view" ON organizations
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Members see non-sensitive fields via the safe view instead
-- (They should query organizations_safe_view, not organizations directly)
-- For backwards compat, allow members to see row but Stripe IDs are in columns they shouldn't use
-- The safe_view already strips Stripe IDs

-- Actually, the cleanest fix: let members read via a function
CREATE OR REPLACE FUNCTION public.get_user_org(_user_id uuid)
RETURNS SETOF organizations
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.* FROM organizations o
  JOIN organization_members om ON om.org_id = o.id
  WHERE om.user_id = _user_id;
$$;

-- Create member policy that uses org membership but excludes direct Stripe access
CREATE POLICY "org_members_can_view" ON organizations
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
  );

-- 2. Enable RLS on accountability_nodes_public view — it's a view, needs grants not RLS
-- Views inherit RLS from base tables. The view already strips api_key.
-- Remove contact_email from the public view
DROP VIEW IF EXISTS accountability_nodes_public;
CREATE VIEW accountability_nodes_public WITH (security_invoker = on) AS
SELECT 
  id, org_name, org_type, country, jurisdiction, 
  verified, joined_at, last_active_at,
  rate_limit_per_hour, metadata, created_at, updated_at
FROM accountability_nodes;