-- =====================================================
-- Phase 11.1 & 11.2: Subscription & Billing System
-- =====================================================

-- ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'active',
  feature_flags JSONB DEFAULT '{
    "analytics": true,
    "automation": false,
    "federation": false,
    "white_label": false,
    "api_access": false
  }'::jsonb,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_status TEXT DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- SUBSCRIPTION PLANS
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_usd NUMERIC NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly',
  features JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ORGANIZATION SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- USAGE METRICS
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC DEFAULT 0,
  period_start TIMESTAMPTZ DEFAULT now(),
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- BILLING USAGE QUEUE
CREATE TABLE IF NOT EXISTS billing_usage_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  quantity BIGINT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false
);

-- BILLING EVENTS
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "org_members_can_view"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = organizations.id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "org_owners_can_update"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

-- RLS Policies for organization_members
CREATE POLICY "members_can_view_own_orgs"
  ON organization_members FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "owners_can_manage_members"
  ON organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = organization_members.org_id
      AND owner_id = auth.uid()
    )
  );

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "plans_public_read"
  ON subscription_plans FOR SELECT
  USING (true);

-- RLS Policies for organization_subscriptions
CREATE POLICY "members_can_view_subscriptions"
  ON organization_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = organization_subscriptions.org_id
      AND m.user_id = auth.uid()
    )
  );

-- RLS Policies for usage_metrics
CREATE POLICY "members_can_view_usage"
  ON usage_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = usage_metrics.org_id
      AND m.user_id = auth.uid()
    )
  );

-- RLS Policies for billing_events
CREATE POLICY "owners_can_view_billing_events"
  ON billing_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = billing_events.org_id
      AND owner_id = auth.uid()
    )
  );

-- Seed subscription plans
INSERT INTO subscription_plans (key, name, price_usd, billing_cycle, features)
VALUES
  ('starter', 'AICIS Starter', 0, 'monthly', '{
    "analytics": true,
    "automation": false,
    "federation": false,
    "white_label": false,
    "api_access": false,
    "api_calls_limit": 1000,
    "scrollcoin_tx_limit": 100
  }'::jsonb),
  ('pro', 'AICIS Pro', 99, 'monthly', '{
    "analytics": true,
    "automation": true,
    "federation": false,
    "white_label": false,
    "api_access": true,
    "api_calls_limit": 50000,
    "scrollcoin_tx_limit": 5000
  }'::jsonb),
  ('enterprise', 'AICIS Enterprise', 499, 'monthly', '{
    "analytics": true,
    "automation": true,
    "federation": true,
    "white_label": false,
    "api_access": true,
    "api_calls_limit": 500000,
    "scrollcoin_tx_limit": 50000
  }'::jsonb),
  ('global_node', 'AICIS Global Node', 50000, 'yearly', '{
    "analytics": true,
    "automation": true,
    "federation": true,
    "white_label": true,
    "api_access": true,
    "api_calls_limit": -1,
    "scrollcoin_tx_limit": -1
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at_trigger
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();