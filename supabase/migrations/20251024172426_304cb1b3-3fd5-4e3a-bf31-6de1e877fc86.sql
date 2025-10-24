-- Phase 11: Business Infrastructure Automation

-- ============================================
-- 1. USAGE RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  metric_key TEXT NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  billed BOOLEAN DEFAULT FALSE,
  stripe_usage_record_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usage_records_org_period ON public.usage_records(org_id, period_start, period_end);
CREATE INDEX idx_usage_records_billed ON public.usage_records(billed) WHERE billed = FALSE;

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view usage records" ON public.usage_records
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = usage_records.org_id AND owner_id = auth.uid()
  )
);

-- ============================================
-- 2. API KEYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  rate_limit_per_minute INTEGER DEFAULT 60,
  revoked BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_api_keys_org ON public.api_keys(org_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked = FALSE;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage api keys" ON public.api_keys
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = api_keys.org_id AND owner_id = auth.uid()
  )
);

-- ============================================
-- 3. REVENUE METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.revenue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  total_revenue NUMERIC DEFAULT 0,
  mrr NUMERIC DEFAULT 0,
  arr NUMERIC DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  new_subscriptions INTEGER DEFAULT 0,
  churned_subscriptions INTEGER DEFAULT 0,
  avg_revenue_per_account NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_date)
);

CREATE INDEX idx_revenue_metrics_date ON public.revenue_metrics(metric_date DESC);

ALTER TABLE public.revenue_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view revenue metrics" ON public.revenue_metrics
FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert revenue metrics" ON public.revenue_metrics
FOR INSERT WITH CHECK (true);

-- ============================================
-- 4. TENANT ONBOARDING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.tenant_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  step TEXT NOT NULL DEFAULT 'profile',
  completed BOOLEAN DEFAULT FALSE,
  profile_complete BOOLEAN DEFAULT FALSE,
  branding_complete BOOLEAN DEFAULT FALSE,
  domain_complete BOOLEAN DEFAULT FALSE,
  plan_complete BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tenant_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage onboarding" ON public.tenant_onboarding
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = tenant_onboarding.org_id AND owner_id = auth.uid()
  )
);

-- ============================================
-- 5. CUSTOM DOMAINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  verification_token TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  ssl_enabled BOOLEAN DEFAULT FALSE,
  dns_configured BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending',
  last_check_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_custom_domains_org ON public.custom_domains(org_id);
CREATE INDEX idx_custom_domains_verified ON public.custom_domains(verified);

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage domains" ON public.custom_domains
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = custom_domains.org_id AND owner_id = auth.uid()
  )
);

-- ============================================
-- 6. BRAND ASSETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  accent_color TEXT DEFAULT '#60a5fa',
  custom_css TEXT,
  favicon_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage brand assets" ON public.brand_assets
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = brand_assets.org_id AND owner_id = auth.uid()
  )
);

-- ============================================
-- 7. WEBHOOK EVENT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.webhook_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  webhook_source TEXT NOT NULL DEFAULT 'stripe',
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_log_type ON public.webhook_event_log(event_type);
CREATE INDEX idx_webhook_log_processed ON public.webhook_event_log(processed);

ALTER TABLE public.webhook_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs" ON public.webhook_event_log
FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert webhook logs" ON public.webhook_event_log
FOR INSERT WITH CHECK (true);

-- ============================================
-- 8. ENHANCE ORGANIZATIONS TABLE
-- ============================================
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_api_keys INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS monthly_api_quota INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS white_label_enabled BOOLEAN DEFAULT FALSE;

-- ============================================
-- 9. UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_tenant_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenant_onboarding_timestamp
BEFORE UPDATE ON public.tenant_onboarding
FOR EACH ROW EXECUTE FUNCTION update_tenant_onboarding_updated_at();

CREATE TRIGGER update_custom_domains_timestamp
BEFORE UPDATE ON public.custom_domains
FOR EACH ROW EXECUTE FUNCTION update_tenant_onboarding_updated_at();

CREATE TRIGGER update_brand_assets_timestamp
BEFORE UPDATE ON public.brand_assets
FOR EACH ROW EXECUTE FUNCTION update_tenant_onboarding_updated_at();

CREATE TRIGGER update_usage_records_timestamp
BEFORE UPDATE ON public.usage_records
FOR EACH ROW EXECUTE FUNCTION update_tenant_onboarding_updated_at();

-- ============================================
-- 10. LOG TABLE FOR TENANT ACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.tenant_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tenant_action_log_org ON public.tenant_action_log(org_id, created_at DESC);

ALTER TABLE public.tenant_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view action logs" ON public.tenant_action_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = tenant_action_log.org_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "System can insert action logs" ON public.tenant_action_log
FOR INSERT WITH CHECK (true);