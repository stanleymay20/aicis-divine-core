
-- ============================================
-- ENTERPRISE SECURITY & COMPLIANCE UPGRADE
-- ============================================

-- 1. FIX FUNCTION SECURITY (search_path issues)
ALTER FUNCTION public.update_organizations_updated_at() SET search_path = public;
ALTER FUNCTION public.update_tenant_onboarding_updated_at() SET search_path = public;

-- 2. COMPREHENSIVE AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'auth.login', 'auth.logout', 'auth.signup', 'auth.password_reset',
    'org.create', 'org.update', 'org.delete',
    'user.invite', 'user.remove', 'user.role_change',
    'data.create', 'data.update', 'data.delete', 'data.export',
    'billing.subscribe', 'billing.cancel', 'billing.payment',
    'api.key_create', 'api.key_revoke',
    'security.breach_attempt', 'security.policy_violation',
    'admin.settings_change', 'admin.backup', 'admin.restore'
  )),
  resource_type text,
  resource_id text,
  ip_address inet,
  user_agent text,
  request_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  severity text CHECK (severity IN ('info', 'warning', 'error', 'critical')) DEFAULT 'info'
);

CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_org ON public.audit_log (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_audit_log_action ON public.audit_log (action);
CREATE INDEX idx_audit_log_severity ON public.audit_log (severity) WHERE severity IN ('error', 'critical');

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON public.audit_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own audit logs" ON public.audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Org owners can view org audit logs" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = audit_log.org_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "System can insert audit logs" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- 3. RATE LIMITING
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address inet,
  endpoint text NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  CONSTRAINT rate_limits_identifier CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

CREATE INDEX idx_rate_limits_user ON public.rate_limits (user_id, endpoint, window_start);
CREATE INDEX idx_rate_limits_ip ON public.rate_limits (ip_address, endpoint, window_start);
CREATE INDEX idx_rate_limits_blocked ON public.rate_limits (blocked_until) WHERE blocked_until IS NOT NULL;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rate limits" ON public.rate_limits
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 4. SESSION MANAGEMENT
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text
);

CREATE INDEX idx_user_sessions_user ON public.user_sessions (user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions (session_token) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_sessions_expires ON public.user_sessions (expires_at);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. IP WHITELIST/BLACKLIST
CREATE TABLE IF NOT EXISTS public.ip_access_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ip_address inet NOT NULL,
  ip_range cidr,
  access_type text NOT NULL CHECK (access_type IN ('whitelist', 'blacklist')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamptz
);

CREATE INDEX idx_ip_access_org ON public.ip_access_control (org_id);
CREATE INDEX idx_ip_access_type ON public.ip_access_control (access_type);

ALTER TABLE public.ip_access_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owners manage IP access" ON public.ip_access_control
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = ip_access_control.org_id AND owner_id = auth.uid()
    )
  );

-- 6. GDPR COMPLIANCE - DATA EXPORT REQUESTS
CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  export_url text,
  expires_at timestamptz,
  completed_at timestamptz,
  error_message text
);

CREATE INDEX idx_data_export_user ON public.data_export_requests (user_id);
CREATE INDEX idx_data_export_status ON public.data_export_requests (status);

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export requests" ON public.data_export_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create export requests" ON public.data_export_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. GDPR COMPLIANCE - DATA DELETION REQUESTS
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')) DEFAULT 'pending',
  reason text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  completed_at timestamptz,
  rejection_reason text
);

CREATE INDEX idx_data_deletion_user ON public.data_deletion_requests (user_id);
CREATE INDEX idx_data_deletion_status ON public.data_deletion_requests (status);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deletion requests" ON public.data_deletion_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create deletion requests" ON public.data_deletion_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage deletion requests" ON public.data_deletion_requests
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 8. HEALTH CHECK & MONITORING
CREATE TABLE IF NOT EXISTS public.system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  component text NOT NULL CHECK (component IN ('database', 'storage', 'edge_functions', 'external_apis', 'realtime')),
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms int,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_system_health_checked ON public.system_health (checked_at DESC);
CREATE INDEX idx_system_health_component ON public.system_health (component);
CREATE INDEX idx_system_health_status ON public.system_health (status) WHERE status != 'healthy';

ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system health" ON public.system_health
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert health checks" ON public.system_health
  FOR INSERT WITH CHECK (true);

-- 9. PERFORMANCE METRICS PER TENANT
CREATE TABLE IF NOT EXISTS public.tenant_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  api_requests_count int DEFAULT 0,
  avg_response_time_ms int,
  error_count int DEFAULT 0,
  storage_used_bytes bigint DEFAULT 0,
  database_queries_count int DEFAULT 0,
  edge_function_invocations int DEFAULT 0,
  active_users_count int DEFAULT 0,
  cost_estimate_usd numeric(10,2),
  UNIQUE(org_id, metric_date)
);

CREATE INDEX idx_tenant_metrics_org ON public.tenant_metrics (org_id, metric_date DESC);

ALTER TABLE public.tenant_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owners can view metrics" ON public.tenant_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = tenant_metrics.org_id AND owner_id = auth.uid()
    )
  );

-- 10. SECURITY HELPER FUNCTIONS

-- Check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _ip inet,
  _endpoint text,
  _limit int DEFAULT 100,
  _window_minutes int DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int;
  _blocked_until timestamptz;
BEGIN
  -- Check if blocked
  SELECT blocked_until INTO _blocked_until
  FROM rate_limits
  WHERE (user_id = _user_id OR ip_address = _ip)
    AND endpoint = _endpoint
    AND blocked_until > now()
  LIMIT 1;

  IF _blocked_until IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Count requests in window
  SELECT COUNT(*) INTO _count
  FROM rate_limits
  WHERE (user_id = _user_id OR ip_address = _ip)
    AND endpoint = _endpoint
    AND window_start > now() - (_window_minutes || ' minutes')::interval;

  IF _count >= _limit THEN
    -- Block for window duration
    INSERT INTO rate_limits (user_id, ip_address, endpoint, request_count, blocked_until)
    VALUES (_user_id, _ip, _endpoint, 1, now() + (_window_minutes || ' minutes')::interval);
    RETURN false;
  END IF;

  -- Increment counter
  INSERT INTO rate_limits (user_id, ip_address, endpoint, request_count)
  VALUES (_user_id, _ip, _endpoint, 1);

  RETURN true;
END;
$$;

-- Log audit event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _user_id uuid,
  _org_id uuid,
  _action text,
  _resource_type text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _severity text DEFAULT 'info'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _audit_id uuid;
BEGIN
  INSERT INTO audit_log (
    user_id, org_id, action, resource_type, resource_id,
    ip_address, user_agent, metadata, severity
  ) VALUES (
    _user_id, _org_id, _action, _resource_type, _resource_id,
    _ip_address, _user_agent, _metadata, _severity
  ) RETURNING id INTO _audit_id;

  RETURN _audit_id;
END;
$$;

-- Check IP access
CREATE OR REPLACE FUNCTION public.check_ip_access(_org_id uuid, _ip_address inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _blacklisted boolean;
  _whitelisted boolean;
  _has_whitelist boolean;
BEGIN
  -- Check blacklist
  SELECT EXISTS (
    SELECT 1 FROM ip_access_control
    WHERE org_id = _org_id
      AND access_type = 'blacklist'
      AND (ip_address = _ip_address OR _ip_address << ip_range)
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO _blacklisted;

  IF _blacklisted THEN
    RETURN false;
  END IF;

  -- Check if whitelist exists
  SELECT EXISTS (
    SELECT 1 FROM ip_access_control
    WHERE org_id = _org_id AND access_type = 'whitelist'
  ) INTO _has_whitelist;

  IF NOT _has_whitelist THEN
    RETURN true;
  END IF;

  -- Check whitelist
  SELECT EXISTS (
    SELECT 1 FROM ip_access_control
    WHERE org_id = _org_id
      AND access_type = 'whitelist'
      AND (ip_address = _ip_address OR _ip_address << ip_range)
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO _whitelisted;

  RETURN _whitelisted;
END;
$$;

-- Cleanup old rate limit records (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < now() - interval '24 hours'
    AND (blocked_until IS NULL OR blocked_until < now());
END;
$$;

-- Auto-expire data exports (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE data_export_requests
  SET status = 'failed', error_message = 'Export expired'
  WHERE status = 'completed'
    AND expires_at < now();
END;
$$;

COMMENT ON TABLE public.audit_log IS 'Comprehensive audit trail for compliance and security';
COMMENT ON TABLE public.rate_limits IS 'Rate limiting per user/IP for DDoS protection';
COMMENT ON TABLE public.user_sessions IS 'Enhanced session management for security';
COMMENT ON TABLE public.ip_access_control IS 'IP whitelist/blacklist for organizations';
COMMENT ON TABLE public.data_export_requests IS 'GDPR Article 20 - Right to data portability';
COMMENT ON TABLE public.data_deletion_requests IS 'GDPR Article 17 - Right to be forgotten';
COMMENT ON TABLE public.system_health IS 'System health monitoring for SLA compliance';
COMMENT ON TABLE public.tenant_metrics IS 'Per-tenant usage and cost tracking';
