
-- Reviewer routing configuration table
CREATE TABLE IF NOT EXISTS reviewer_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  criticality_tier text NOT NULL DEFAULT 'standard',
  default_reviewer text NOT NULL,
  default_reviewer_role text NOT NULL DEFAULT 'analyst',
  max_active_assignments int DEFAULT 10,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(domain, criticality_tier)
);

ALTER TABLE reviewer_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read routing rules" ON reviewer_routing_rules
  FOR SELECT TO authenticated USING (true);

-- Seed default routing rules
INSERT INTO reviewer_routing_rules (domain, criticality_tier, default_reviewer, default_reviewer_role)
VALUES
  ('security', 'standard', 'Security Analyst', 'analyst'),
  ('security', 'elevated', 'Senior Security Analyst', 'senior_analyst'),
  ('security', 'critical', 'CISO', 'executive'),
  ('health', 'standard', 'Health Analyst', 'analyst'),
  ('health', 'elevated', 'Senior Health Analyst', 'senior_analyst'),
  ('health', 'critical', 'Health Director', 'executive'),
  ('finance', 'standard', 'Finance Analyst', 'analyst'),
  ('finance', 'critical', 'CFO', 'executive'),
  ('energy', 'standard', 'Energy Analyst', 'analyst'),
  ('food', 'standard', 'Food Security Analyst', 'analyst'),
  ('governance', 'standard', 'Governance Analyst', 'analyst'),
  ('governance', 'critical', 'Governance Director', 'executive'),
  ('system', 'standard', 'System Analyst', 'analyst'),
  ('system', 'critical', 'System Director', 'executive')
ON CONFLICT (domain, criticality_tier) DO NOTHING;
