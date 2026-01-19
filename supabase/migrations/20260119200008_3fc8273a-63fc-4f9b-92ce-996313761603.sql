-- Governance Trades Table
CREATE TABLE IF NOT EXISTS public.governance_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  asset_symbol TEXT NOT NULL,
  asset_amount NUMERIC NOT NULL,
  price NUMERIC NOT NULL DEFAULT 1.0,
  sc_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades" ON public.governance_trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trades" ON public.governance_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- DAO Spaces Table
CREATE TABLE IF NOT EXISTS public.dao_spaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  voting_delay_hours INTEGER DEFAULT 24,
  voting_period_hours INTEGER DEFAULT 72,
  quorum_percentage NUMERIC DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dao_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view DAO spaces" ON public.dao_spaces
  FOR SELECT USING (true);

-- DAO Proposals Table  
CREATE TABLE IF NOT EXISTS public.dao_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID REFERENCES public.dao_spaces(id),
  proposer_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  proposal_type TEXT DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'active',
  voting_starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voting_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),
  votes_for NUMERIC DEFAULT 0,
  votes_against NUMERIC DEFAULT 0,
  votes_abstain NUMERIC DEFAULT 0,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dao_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view proposals" ON public.dao_proposals
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create proposals" ON public.dao_proposals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- DAO Votes Table
CREATE TABLE IF NOT EXISTS public.dao_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES public.dao_proposals(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES auth.users(id),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('for', 'against', 'abstain')),
  voting_power NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, voter_id)
);

ALTER TABLE public.dao_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes" ON public.dao_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can create own votes" ON public.dao_votes
  FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- DAO Stake Snapshots Table
CREATE TABLE IF NOT EXISTS public.dao_stake_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  space_id UUID REFERENCES public.dao_spaces(id),
  stake_amount NUMERIC NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dao_stake_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stake snapshots" ON public.dao_stake_snapshots
  FOR SELECT USING (true);

-- Predictions Table Enhancement
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS division TEXT;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS forecast JSONB;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0.7;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS volatility_index NUMERIC DEFAULT 0.15;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS predicted_at TIMESTAMPTZ DEFAULT now();

-- SC Oracle Prices (if not exists)
CREATE TABLE IF NOT EXISTS public.sc_oracle_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'internal',
  value NUMERIC NOT NULL DEFAULT 1.0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sc_oracle_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view oracle prices" ON public.sc_oracle_prices
  FOR SELECT USING (true);

-- Governance Global Data Table
CREATE TABLE IF NOT EXISTS public.governance_global (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country TEXT NOT NULL,
  iso3 TEXT,
  indicator TEXT NOT NULL,
  value NUMERIC,
  year INTEGER,
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view governance data" ON public.governance_global
  FOR SELECT USING (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.dao_proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.governance_trades;