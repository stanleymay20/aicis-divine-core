
-- ============================================================
-- SECURITY LOCKDOWN — Truth Alignment Sprint
-- Fixes all ERROR-level and critical WARN-level RLS issues
-- ============================================================

-- 1. spc_control_observations: restrict to service_role + authenticated read
DROP POLICY IF EXISTS "Service role manages SPC" ON public.spc_control_observations;
CREATE POLICY "Service role manages SPC"
  ON public.spc_control_observations FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read SPC"
  ON public.spc_control_observations FOR SELECT
  TO authenticated USING (true);

-- 2. accountability_nodes: create a safe view excluding sensitive columns
DROP VIEW IF EXISTS public.accountability_nodes_public;
CREATE VIEW public.accountability_nodes_public
WITH (security_invoker = on) AS
  SELECT id, org_name, country, org_type, jurisdiction, verified, joined_at, last_active_at, created_at
  FROM public.accountability_nodes;

-- Remove the broad authenticated SELECT, replace with admin-only direct access
DROP POLICY IF EXISTS "Authenticated users can view verified nodes (limited columns)" ON public.accountability_nodes;
DROP POLICY IF EXISTS "Admins can manage nodes" ON public.accountability_nodes;
CREATE POLICY "Only admins can read nodes directly"
  ON public.accountability_nodes FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. system_logs: restrict to own logs + admin
DROP POLICY IF EXISTS "System logs viewable by authenticated users" ON public.system_logs;
CREATE POLICY "Users can view own system logs"
  ON public.system_logs FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 4. security_incidents: restrict to authenticated only
DROP POLICY IF EXISTS "r_si" ON public.security_incidents;
CREATE POLICY "Authenticated users can read security incidents"
  ON public.security_incidents FOR SELECT
  TO authenticated USING (true);

-- 5. satellite_observations: restrict to authenticated only
DROP POLICY IF EXISTS "read_sat_obs" ON public.satellite_observations;
CREATE POLICY "Authenticated users can read satellite observations"
  ON public.satellite_observations FOR SELECT
  TO authenticated USING (true);

-- 6. critical_alerts: restrict read to authenticated, update to admin/operator
DROP POLICY IF EXISTS "r_ca" ON public.critical_alerts;
DROP POLICY IF EXISTS "u_ca_ack" ON public.critical_alerts;
CREATE POLICY "Authenticated users can read critical alerts"
  ON public.critical_alerts FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Admins and operators can update critical alerts"
  ON public.critical_alerts FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 7. federation_peers: restrict to authenticated
DROP POLICY IF EXISTS "read_all_auth_peers" ON public.federation_peers;
CREATE POLICY "Authenticated users can read federation peers"
  ON public.federation_peers FOR SELECT
  TO authenticated USING (true);

-- 8. federation_outbound_queue: restrict to authenticated
DROP POLICY IF EXISTS "read_all_auth_out" ON public.federation_outbound_queue;
CREATE POLICY "Authenticated users can read outbound queue"
  ON public.federation_outbound_queue FOR SELECT
  TO authenticated USING (true);

-- 9. federation_inbound_signals: restrict to authenticated
DROP POLICY IF EXISTS "read_all_auth_in" ON public.federation_inbound_signals;
CREATE POLICY "Authenticated users can read inbound signals"
  ON public.federation_inbound_signals FOR SELECT
  TO authenticated USING (true);

-- 10. defense_posture: restrict read to authenticated (already role-gated for writes)
DROP POLICY IF EXISTS "Defense posture viewable by authenticated users" ON public.defense_posture;
CREATE POLICY "Authenticated users can read defense posture"
  ON public.defense_posture FOR SELECT
  TO authenticated USING (true);

-- 11. approvals: restrict read to requester/admin, not everyone
DROP POLICY IF EXISTS "Approvals viewable by authenticated users" ON public.approvals;
DROP POLICY IF EXISTS "Authenticated users can create approval requests" ON public.approvals;
CREATE POLICY "Users can view own or admin can view all approvals"
  ON public.approvals FOR SELECT
  TO authenticated USING (requester = auth.uid() OR created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can create approval requests"
  ON public.approvals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requester);

-- 12. intelligence_signals: restrict updates to admin/operator
DROP POLICY IF EXISTS "Users can acknowledge signals" ON public.intelligence_signals;
DROP POLICY IF EXISTS "Operators can insert intelligence signals" ON public.intelligence_signals;
CREATE POLICY "Admins and operators can update signals"
  ON public.intelligence_signals FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));
CREATE POLICY "Service role can insert intelligence signals"
  ON public.intelligence_signals FOR INSERT
  TO service_role WITH CHECK (true);

-- 13. Add index on signal_audit_chain for performance
CREATE INDEX IF NOT EXISTS idx_signal_audit_chain_signal_id ON public.signal_audit_chain(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_audit_chain_generated_at ON public.signal_audit_chain(generated_at DESC);
