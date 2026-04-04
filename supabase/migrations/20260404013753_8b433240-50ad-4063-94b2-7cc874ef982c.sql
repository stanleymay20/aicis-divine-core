
-- Create signal category enum
CREATE TYPE public.signal_category AS ENUM (
  'geopolitical', 'economic', 'financial_markets', 'central_banking',
  'public_health', 'climate_disaster', 'energy', 'technology',
  'cybersecurity', 'defense_conflict', 'legal_regulatory',
  'supply_chain', 'elections', 'social_unrest', 'infrastructure'
);

-- Create signal status enum
CREATE TYPE public.signal_status AS ENUM (
  'new', 'developing', 'confirmed', 'resolved', 'watchlist'
);

-- Create the global_signals table
CREATE TABLE public.global_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  normalized_summary TEXT,
  category signal_category NOT NULL,
  subcategory TEXT,
  status signal_status NOT NULL DEFAULT 'new',
  confidence_score SMALLINT NOT NULL DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  impact_score SMALLINT NOT NULL DEFAULT 50 CHECK (impact_score >= 0 AND impact_score <= 100),
  urgency_score SMALLINT NOT NULL DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100),
  source_count SMALLINT NOT NULL DEFAULT 1,
  primary_source TEXT,
  source_references JSONB DEFAULT '[]'::jsonb,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latest_update_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurred_at TIMESTAMPTZ,
  affected_regions TEXT[] DEFAULT '{}',
  affected_countries TEXT[] DEFAULT '{}',
  affected_sectors TEXT[] DEFAULT '{}',
  affected_stakeholders TEXT[] DEFAULT '{}',
  strategic_implications TEXT,
  likely_consequences TEXT,
  uncertainty_notes TEXT,
  misinformation_risk SMALLINT DEFAULT 0 CHECK (misinformation_risk >= 0 AND misinformation_risk <= 100),
  recommended_actions JSONB DEFAULT '{}'::jsonb,
  decision_candidates JSONB DEFAULT '[]'::jsonb,
  routing_targets TEXT[] DEFAULT '{}',
  impact_reasoning TEXT,
  audience_framing JSONB DEFAULT '{}'::jsonb,
  evidence_hash TEXT,
  model_version TEXT,
  classification_time_ms INTEGER,
  ingestion_source TEXT,
  dedup_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_global_signals_category ON public.global_signals (category);
CREATE INDEX idx_global_signals_status ON public.global_signals (status);
CREATE INDEX idx_global_signals_impact ON public.global_signals (impact_score DESC);
CREATE INDEX idx_global_signals_urgency ON public.global_signals (urgency_score DESC);
CREATE INDEX idx_global_signals_first_detected ON public.global_signals (first_detected_at DESC);
CREATE INDEX idx_global_signals_dedup ON public.global_signals (dedup_key);
CREATE INDEX idx_global_signals_affected_countries ON public.global_signals USING GIN (affected_countries);
CREATE INDEX idx_global_signals_affected_sectors ON public.global_signals USING GIN (affected_sectors);

-- Enable RLS
ALTER TABLE public.global_signals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all signals
CREATE POLICY "Authenticated users can view signals"
ON public.global_signals FOR SELECT
TO authenticated
USING (true);

-- Service role inserts (edge functions)
CREATE POLICY "Service role can insert signals"
ON public.global_signals FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update signals"
ON public.global_signals FOR UPDATE
TO service_role
USING (true);

-- Updated_at trigger
CREATE TRIGGER update_global_signals_updated_at
  BEFORE UPDATE ON public.global_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_signals;
