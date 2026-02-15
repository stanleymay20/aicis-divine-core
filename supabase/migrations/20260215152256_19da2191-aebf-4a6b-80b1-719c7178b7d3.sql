
-- Fix RLS-enabled-no-policy tables
CREATE POLICY "Service role can manage billing usage"
  ON public.billing_usage_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Org members can read billing usage"
  ON public.billing_usage_queue FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage ethics reviewers"
  ON public.ethics_reviewers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Reviewers can view own record"
  ON public.ethics_reviewers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can manage ethics reviewers"
  ON public.ethics_reviewers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
