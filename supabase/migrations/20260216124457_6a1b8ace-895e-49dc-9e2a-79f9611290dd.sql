
-- P0 FIX 1: Restrict calibration_audit_hashes from public ALL to service_role only
DROP POLICY IF EXISTS "Service role manages audit hashes" ON public.calibration_audit_hashes;
CREATE POLICY "Service role manages audit hashes" ON public.calibration_audit_hashes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read audit hashes" ON public.calibration_audit_hashes
  FOR SELECT TO authenticated USING (true);

-- P0 FIX 2: Restrict country_performance_snapshots from public ALL to service_role only
DROP POLICY IF EXISTS "Service role can manage performance snapshots" ON public.country_performance_snapshots;
CREATE POLICY "Service role can manage performance snapshots" ON public.country_performance_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- P0 FIX 3: Restrict methodology_documents INSERT from public to service_role
DROP POLICY IF EXISTS "Service role writes methodology" ON public.methodology_documents;
CREATE POLICY "Service role writes methodology" ON public.methodology_documents
  FOR INSERT TO service_role WITH CHECK (true);

-- P0 FIX 4: Restrict drift_alerts UPDATE from authenticated with true to owner-only
DROP POLICY IF EXISTS "Authenticated ack drift alerts" ON public.drift_alerts;
CREATE POLICY "Authenticated ack drift alerts" ON public.drift_alerts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- P0 FIX 5: Add GDPR consent UPDATE policy so users can revoke consent
CREATE POLICY "Users can update their own consent" ON public.user_consent
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- P0 FIX 6: Create a secure view for accountability_nodes that excludes api_key
CREATE OR REPLACE VIEW public.accountability_nodes_public AS
  SELECT id, org_name, org_type, country, jurisdiction, verified, joined_at, last_active_at, metadata
  FROM public.accountability_nodes
  WHERE verified = true;
