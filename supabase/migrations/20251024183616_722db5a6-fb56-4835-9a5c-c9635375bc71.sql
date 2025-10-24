-- Create enums for accountability system
CREATE TYPE public.org_type AS ENUM ('government', 'ngo', 'agency', 'academic', 'private');
CREATE TYPE public.ledger_entry_type AS ENUM ('ethics', 'sdg', 'finance', 'policy', 'crisis', 'compliance');

-- Accountability Nodes (Institutional Registry)
CREATE TABLE public.accountability_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL,
  country TEXT NOT NULL,
  org_type public.org_type NOT NULL,
  api_key UUID UNIQUE DEFAULT gen_random_uuid(),
  verified BOOLEAN DEFAULT false,
  jurisdiction TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  contact_email TEXT,
  pgp_public_key TEXT,
  api_endpoint TEXT,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  last_active_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Node Audit Trail
CREATE TABLE public.node_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES public.accountability_nodes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT
);

-- Immutable Accountability Ledger
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type public.ledger_entry_type NOT NULL,
  node_id UUID REFERENCES public.accountability_nodes(id),
  hash TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  signature TEXT,
  previous_hash TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  verified BOOLEAN DEFAULT false,
  block_number BIGSERIAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ledger Root Hash Chain (for daily integrity checks)
CREATE TABLE public.ledger_root_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root_hash TEXT NOT NULL,
  block_count INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  verified BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Data Sharing Agreements
CREATE TABLE public.data_sharing_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES public.accountability_nodes(id),
  agreement_type TEXT NOT NULL,
  sdg_tags TEXT[],
  signed_contract JSONB NOT NULL,
  signature TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ
);

-- Enable RLS on all tables
ALTER TABLE public.accountability_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_root_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sharing_agreements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accountability_nodes
CREATE POLICY "Admins can manage nodes"
ON public.accountability_nodes FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Verified nodes can view other verified nodes"
ON public.accountability_nodes FOR SELECT
USING (verified = true);

CREATE POLICY "Authenticated users can view verified nodes"
ON public.accountability_nodes FOR SELECT
USING (auth.uid() IS NOT NULL AND verified = true);

-- RLS Policies for node_audit_trail
CREATE POLICY "Admins can view all audit trails"
ON public.node_audit_trail FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Nodes can view their own audit trail"
ON public.node_audit_trail FOR SELECT
USING (node_id IN (SELECT id FROM accountability_nodes WHERE api_key::text = current_setting('request.headers', true)::json->>'x-aicis-node-key'));

CREATE POLICY "System can insert audit trails"
ON public.node_audit_trail FOR INSERT
WITH CHECK (true);

-- RLS Policies for ledger_entries
CREATE POLICY "Admins can manage ledger entries"
ON public.ledger_entries FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view verified ledger entries"
ON public.ledger_entries FOR SELECT
USING (auth.uid() IS NOT NULL AND verified = true);

CREATE POLICY "Nodes can insert ledger entries"
ON public.ledger_entries FOR INSERT
WITH CHECK (true);

-- RLS Policies for ledger_root_hashes
CREATE POLICY "Everyone can view root hashes"
ON public.ledger_root_hashes FOR SELECT
USING (true);

CREATE POLICY "System can insert root hashes"
ON public.ledger_root_hashes FOR INSERT
WITH CHECK (true);

-- RLS Policies for data_sharing_agreements
CREATE POLICY "Admins can manage agreements"
ON public.data_sharing_agreements FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Nodes can view their agreements"
ON public.data_sharing_agreements FOR SELECT
USING (node_id IN (SELECT id FROM accountability_nodes WHERE api_key::text = current_setting('request.headers', true)::json->>'x-aicis-node-key'));

-- Create indexes for performance
CREATE INDEX idx_nodes_verified ON public.accountability_nodes(verified);
CREATE INDEX idx_nodes_jurisdiction ON public.accountability_nodes(jurisdiction);
CREATE INDEX idx_audit_node_timestamp ON public.node_audit_trail(node_id, timestamp DESC);
CREATE INDEX idx_ledger_type_timestamp ON public.ledger_entries(entry_type, timestamp DESC);
CREATE INDEX idx_ledger_hash ON public.ledger_entries(hash);
CREATE INDEX idx_ledger_block ON public.ledger_entries(block_number DESC);

-- Seed initial accountability nodes (examples)
INSERT INTO public.accountability_nodes (org_name, country, org_type, verified, jurisdiction, contact_email, metadata) VALUES
('United Nations Development Programme', 'International', 'agency', true, 'global', 'accountability@undp.org', '{"sdg_focus": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]}'::jsonb),
('World Health Organization', 'International', 'agency', true, 'global', 'ethics@who.int', '{"sdg_focus": [3]}'::jsonb),
('Transparency International', 'International', 'ngo', true, 'global', 'contact@transparency.org', '{"sdg_focus": [16]}'::jsonb);