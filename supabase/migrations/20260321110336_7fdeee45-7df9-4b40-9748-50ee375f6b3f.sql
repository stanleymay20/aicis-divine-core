-- 1. Secure view for organizations hiding Stripe IDs from non-owners
CREATE OR REPLACE VIEW public.organizations_safe_view AS
SELECT 
  id, name, owner_id, tier, status, feature_flags,
  CASE WHEN auth.uid() = owner_id THEN stripe_customer_id ELSE NULL END as stripe_customer_id,
  CASE WHEN auth.uid() = owner_id THEN stripe_subscription_id ELSE NULL END as stripe_subscription_id,
  billing_status, trial_ends_at, cancel_at_period_end,
  created_at, updated_at, api_enabled, max_api_keys, monthly_api_quota, white_label_enabled
FROM organizations;

-- 2. Recreate accountability_nodes_public without api_key
DROP VIEW IF EXISTS accountability_nodes_public;
CREATE VIEW accountability_nodes_public AS
SELECT 
  id, org_name, org_type, country, jurisdiction, 
  verified, joined_at, last_active_at, contact_email,
  rate_limit_per_hour, metadata, created_at, updated_at
FROM accountability_nodes;

-- 3. Add hash column for future secure key comparison
ALTER TABLE accountability_nodes ADD COLUMN IF NOT EXISTS api_key_hash text;

-- 4. Ensure accountability_nodes is admin-only
DROP POLICY IF EXISTS "Admins can manage nodes" ON accountability_nodes;
CREATE POLICY "Admins can manage nodes" ON accountability_nodes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));