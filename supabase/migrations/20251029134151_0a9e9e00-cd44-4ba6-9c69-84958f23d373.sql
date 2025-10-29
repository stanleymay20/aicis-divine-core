
-- Create governance assets table for trading/market features
CREATE TABLE IF NOT EXISTS public.governance_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_symbol text NOT NULL UNIQUE,
  asset_name text NOT NULL,
  current_price numeric NOT NULL DEFAULT 0,
  price_change_24h numeric DEFAULT 0,
  total_supply numeric DEFAULT 0,
  market_cap numeric DEFAULT 0,
  enabled boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_governance_assets_symbol ON public.governance_assets (asset_symbol);
CREATE INDEX idx_governance_assets_enabled ON public.governance_assets (enabled) WHERE enabled = true;

ALTER TABLE public.governance_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Governance assets viewable by authenticated users" ON public.governance_assets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage governance assets" ON public.governance_assets
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create partner oracles table
CREATE TABLE IF NOT EXISTS public.partner_oracles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL,
  endpoint_url text NOT NULL,
  api_key_hash text,
  trust_score numeric NOT NULL DEFAULT 0.5 CHECK (trust_score >= 0 AND trust_score <= 1),
  enabled boolean DEFAULT true,
  response_time_avg_ms int,
  last_sync_at timestamptz,
  success_rate numeric DEFAULT 1.0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_oracles_enabled ON public.partner_oracles (enabled) WHERE enabled = true;
CREATE INDEX idx_partner_oracles_trust ON public.partner_oracles (trust_score DESC);

ALTER TABLE public.partner_oracles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner oracles viewable by authenticated users" ON public.partner_oracles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage partner oracles" ON public.partner_oracles
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create SC oracle prices table
CREATE TABLE IF NOT EXISTS public.sc_oracle_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  price_usd numeric NOT NULL,
  volume_24h numeric DEFAULT 0,
  source text NOT NULL,
  confidence numeric DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sc_oracle_prices_symbol ON public.sc_oracle_prices (symbol, captured_at DESC);
CREATE INDEX idx_sc_oracle_prices_captured ON public.sc_oracle_prices (captured_at DESC);

ALTER TABLE public.sc_oracle_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SC oracle prices viewable by authenticated users" ON public.sc_oracle_prices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert oracle prices" ON public.sc_oracle_prices
  FOR INSERT WITH CHECK (true);

-- Insert sample data
INSERT INTO public.governance_assets (asset_symbol, asset_name, current_price, price_change_24h, total_supply, market_cap) VALUES
  ('SC', 'System Credit', 1.00, 0.0, 1000000000, 1000000000),
  ('BTC', 'Bitcoin', 45000.00, 2.5, 21000000, 945000000000),
  ('ETH', 'Ethereum', 2500.00, 1.8, 120000000, 300000000000),
  ('USDC', 'USD Coin', 1.00, 0.0, 50000000000, 50000000000)
ON CONFLICT (asset_symbol) DO NOTHING;

INSERT INTO public.partner_oracles (partner_name, endpoint_url, trust_score, enabled) VALUES
  ('Alpha Vantage', 'https://www.alphavantage.co/query', 0.95, true),
  ('CoinGecko', 'https://api.coingecko.com/api/v3', 0.90, true),
  ('World Bank', 'https://api.worldbank.org/v2', 0.85, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.sc_oracle_prices (symbol, price_usd, volume_24h, source, confidence) VALUES
  ('SC', 1.00, 1000000, 'internal', 1.0),
  ('BTC', 45000.00, 25000000000, 'coingecko', 0.95),
  ('ETH', 2500.00, 15000000000, 'coingecko', 0.95),
  ('USDC', 1.00, 5000000000, 'coinbase', 1.0);

COMMENT ON TABLE public.governance_assets IS 'Tradeable assets in the governance market';
COMMENT ON TABLE public.partner_oracles IS 'External data oracle partners for price feeds';
COMMENT ON TABLE public.sc_oracle_prices IS 'System Credit and other asset prices from oracles';
