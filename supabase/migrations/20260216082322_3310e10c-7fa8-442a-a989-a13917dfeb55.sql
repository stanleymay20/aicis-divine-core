
-- ═══════════════════════════════════════════════════════════════
-- Political Stability & Election Volatility Module — Schema
-- Shadow mode: data collected but NOT included in NPI or briefs
-- ═══════════════════════════════════════════════════════════════

-- 1. Political events (GDELT-sourced, later ACLED)
CREATE TABLE public.political_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iso3 TEXT NOT NULL,
  event_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'gdelt',
  event_type TEXT NOT NULL,          -- protest, riot, conflict, coup_signal, unrest
  event_count INTEGER NOT NULL DEFAULT 1,
  avg_tone NUMERIC,
  goldstein_scale NUMERIC,           -- GDELT conflict intensity (-10 to +10)
  source_url TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(iso3, event_date, source, event_type)
);

CREATE INDEX idx_political_events_iso3_date ON public.political_events(iso3, event_date DESC);
CREATE INDEX idx_political_events_source ON public.political_events(source);

ALTER TABLE public.political_events ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated, write via service_role
CREATE POLICY "Authenticated read political events"
  ON public.political_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages political events"
  ON public.political_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Election calendar (International IDEA / manual seed)
CREATE TABLE public.election_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iso3 TEXT NOT NULL,
  election_date DATE NOT NULL,
  election_type TEXT NOT NULL,       -- presidential, parliamentary, referendum, local
  description TEXT,
  source TEXT DEFAULT 'idea',
  confidence NUMERIC DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(iso3, election_date, election_type)
);

CREATE INDEX idx_election_calendar_iso3 ON public.election_calendar(iso3);
CREATE INDEX idx_election_calendar_date ON public.election_calendar(election_date);

ALTER TABLE public.election_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read election calendar"
  ON public.election_calendar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages election calendar"
  ON public.election_calendar FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Political stability scores (shadow mode output)
CREATE TABLE public.political_stability_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iso3 TEXT NOT NULL,
  score_date DATE NOT NULL,
  stability_score NUMERIC NOT NULL,              -- 0-100
  protest_momentum NUMERIC,                      -- OLS slope on 30d protest counts
  protest_momentum_tstat NUMERIC,                -- t-stat for significance
  conflict_density NUMERIC,                      -- events per million pop (normalized)
  election_volatility_risk NUMERIC,              -- 0-100, scaled by proximity to election
  volatility_index NUMERIC,                      -- 90d downside/upside
  structural_break_flag BOOLEAN DEFAULT false,
  structural_break_pvalue NUMERIC,
  confidence_score NUMERIC,
  days_to_next_election INTEGER,
  mode TEXT NOT NULL DEFAULT 'shadow',            -- shadow | challenger | active
  model_version TEXT NOT NULL DEFAULT 'PSM-V1.0',
  raw_metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(iso3, score_date, model_version)
);

CREATE INDEX idx_pss_iso3_date ON public.political_stability_scores(iso3, score_date DESC);
CREATE INDEX idx_pss_mode ON public.political_stability_scores(mode);

ALTER TABLE public.political_stability_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read stability scores"
  ON public.political_stability_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages stability scores"
  ON public.political_stability_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
