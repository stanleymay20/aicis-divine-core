
-- 1. FIX: Recreate org member view without Stripe fields
DROP VIEW IF EXISTS public.organizations_member_view CASCADE;
CREATE VIEW public.organizations_member_view
WITH (security_invoker = true) AS
  SELECT id, name, tier, status, billing_status, feature_flags,
         api_enabled, max_api_keys, monthly_api_quota, owner_id,
         white_label_enabled, created_at, updated_at
  FROM public.organizations;

-- 2. FIX: Rate limits — restrict to own records
DROP POLICY IF EXISTS "Users can read own rate limits" ON public.rate_limits;
CREATE POLICY "Users can read own rate limits"
  ON public.rate_limits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. FIX: partner_oracles — restrict to admin/operator
DROP POLICY IF EXISTS "Partner oracles viewable by authenticated users" ON public.partner_oracles;
CREATE POLICY "Partner oracles viewable by operators"
  ON public.partner_oracles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- 4. FIX: daily_system_health INSERT — restrict
DROP POLICY IF EXISTS "Service insert daily_system_health" ON public.daily_system_health;
CREATE POLICY "Operators can insert daily_system_health"
  ON public.daily_system_health FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));
