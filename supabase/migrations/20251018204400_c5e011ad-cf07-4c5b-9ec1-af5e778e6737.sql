-- Phase 10.11 – Global Federated Learning & Policy Sharing

-- ===== Federation config & trust =====
CREATE TABLE IF NOT EXISTS public.federation_peers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  pubkey_pem TEXT NOT NULL,
  trust_score NUMERIC(5,2) DEFAULT 80 CHECK (trust_score BETWEEN 0 AND 100),
  send_enabled BOOLEAN DEFAULT true,
  recv_enabled BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_url)
);

-- What we will send (local exports)
CREATE TABLE IF NOT EXISTS public.federation_outbound_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  attempts INT DEFAULT 0,
  last_attempt TIMESTAMPTZ
);

-- What we receive (normalized inbound)
CREATE TABLE IF NOT EXISTS public.federation_inbound_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID REFERENCES public.federation_peers(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  signals JSONB NOT NULL,
  signature_valid BOOLEAN DEFAULT false,
  peer_trust NUMERIC(5,2) DEFAULT 0,
  summary_strength NUMERIC(6,3) DEFAULT 0
);

-- Federation policy/opts
CREATE TABLE IF NOT EXISTS public.federation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_divisions TEXT[] DEFAULT ARRAY['finance','energy','health','food','defense','diplomacy','crisis','governance'],
  min_sample INT DEFAULT 10,
  dp_epsilon NUMERIC(5,2) DEFAULT 1.0,
  max_daily_weight_drift NUMERIC(5,2) DEFAULT 0.15,
  enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.federation_peers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_outbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_inbound_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_all_auth_peers ON public.federation_peers FOR SELECT USING (true);
CREATE POLICY read_all_auth_out ON public.federation_outbound_queue FOR SELECT USING (true);
CREATE POLICY read_all_auth_in ON public.federation_inbound_signals FOR SELECT USING (true);
CREATE POLICY read_all_auth_pol ON public.federation_policies FOR SELECT USING (true);

CREATE POLICY manage_admin_peers ON public.federation_peers FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY manage_admin_out ON public.federation_outbound_queue FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY manage_admin_in ON public.federation_inbound_signals FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY manage_admin_pol ON public.federation_policies FOR ALL USING (has_role(auth.uid(),'admin'::app_role));

-- Seed default policy
INSERT INTO public.federation_policies (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;