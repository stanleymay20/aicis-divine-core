
-- Fix overly permissive policies - use service_role for system-managed tables
DROP POLICY IF EXISTS "silent_failure_manage_admin" ON silent_failure_state;
CREATE POLICY "silent_failure_insert_service" ON silent_failure_state FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "silent_failure_update_service" ON silent_failure_state FOR UPDATE TO service_role USING (true);
