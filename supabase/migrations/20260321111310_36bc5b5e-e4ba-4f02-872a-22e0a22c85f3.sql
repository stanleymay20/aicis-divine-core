-- ═══════════════════════════════════════════════════════════════
-- SECURITY LOCKDOWN: Move sensitive SELECT policies from public → authenticated
-- ═══════════════════════════════════════════════════════════════

-- 1. Fix organizations_safe_view: remove Stripe IDs entirely from view
DROP VIEW IF EXISTS public.organizations_safe_view;
CREATE VIEW public.organizations_safe_view WITH (security_invoker = on) AS
SELECT 
  id, name, owner_id, tier, status, feature_flags,
  billing_status, trial_ends_at, cancel_at_period_end,
  created_at, updated_at, api_enabled, max_api_keys, monthly_api_quota, white_label_enabled
FROM organizations;

-- 2. Intelligence tables: public → authenticated
DROP POLICY IF EXISTS "Intelligence index viewable by authenticated users" ON intelligence_index;
CREATE POLICY "Intelligence index viewable by authenticated users" ON intelligence_index
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Risk predictions viewable by authenticated users" ON risk_predictions;
CREATE POLICY "Risk predictions viewable by authenticated users" ON risk_predictions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Diplo signals viewable by authenticated users" ON diplo_signals;
CREATE POLICY "Diplo signals viewable by authenticated users" ON diplo_signals
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Crisis events viewable by authenticated users" ON crisis_events;
CREATE POLICY "Crisis events viewable by authenticated users" ON crisis_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anomaly detections viewable by authenticated users" ON anomaly_detections;
CREATE POLICY "Anomaly detections viewable by authenticated users" ON anomaly_detections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Objectives viewable by authenticated users" ON objectives;
CREATE POLICY "Objectives viewable by authenticated users" ON objectives
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Tasks viewable by authenticated users" ON objective_tasks;
CREATE POLICY "Tasks viewable by authenticated users" ON objective_tasks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read_all_auth_pol" ON federation_policies;
CREATE POLICY "Federation policies viewable by authenticated users" ON federation_policies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gov policies viewable by authenticated users" ON gov_policies;
CREATE POLICY "Gov policies viewable by authenticated users" ON gov_policies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Intel events viewable by authenticated users" ON intel_events;
CREATE POLICY "Intel events viewable by authenticated users" ON intel_events
  FOR SELECT TO authenticated USING (true);

-- 3. Node tables: fix public role to authenticated
DROP POLICY IF EXISTS "Nodes can view their agreements" ON data_sharing_agreements;
CREATE POLICY "Nodes can view their agreements" ON data_sharing_agreements
  FOR SELECT TO authenticated
  USING (node_id IN (
    SELECT id FROM accountability_nodes
    WHERE api_key::text = (current_setting('request.headers', true)::json->>'x-aicis-node-key')
  ));

DROP POLICY IF EXISTS "Nodes can view their own DUAs" ON data_use_agreements;
CREATE POLICY "Nodes can view their own DUAs" ON data_use_agreements
  FOR SELECT TO authenticated
  USING (node_id IN (
    SELECT id FROM accountability_nodes
    WHERE api_key::text = (current_setting('request.headers', true)::json->>'x-aicis-node-key')
  ));

DROP POLICY IF EXISTS "Nodes can view their own audit trail" ON node_audit_trail;
CREATE POLICY "Nodes can view their own audit trail" ON node_audit_trail
  FOR SELECT TO authenticated
  USING (node_id IN (
    SELECT id FROM accountability_nodes
    WHERE api_key::text = (current_setting('request.headers', true)::json->>'x-aicis-node-key')
  ));