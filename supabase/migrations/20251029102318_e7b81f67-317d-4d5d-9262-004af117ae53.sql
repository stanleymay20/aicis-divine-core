-- Create tables for AICIS Global Live Integration
-- Finance & Economy Data
CREATE TABLE IF NOT EXISTS finance_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  iso_code text,
  source text NOT NULL, -- 'alphavantage', 'binance', 'imf', 'worldbank', 'oecd', 'eia', 'nasdaq'
  indicator_name text NOT NULL,
  value numeric NOT NULL,
  currency text,
  date date NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_data_country ON finance_data(country);
CREATE INDEX IF NOT EXISTS idx_finance_data_date ON finance_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_data_source ON finance_data(source);

-- Security Events (AbuseIPDB, NVD, VirusTotal)
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, -- 'abuseipdb', 'nvd', 'virustotal', 'shodan'
  event_type text NOT NULL,
  severity text NOT NULL, -- 'critical', 'high', 'medium', 'low'
  title text NOT NULL,
  description text,
  affected_systems jsonb,
  cve_id text,
  ip_address inet,
  threat_score integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_detected ON security_events(detected_at DESC);

-- Health Metrics (WHO, CDC, UNICEF, OWID)
CREATE TABLE IF NOT EXISTS health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  iso_code text,
  source text NOT NULL, -- 'who', 'cdc', 'unicef', 'owid', 'oecd'
  metric_name text NOT NULL,
  value numeric NOT NULL,
  unit text,
  age_group text,
  sex text,
  date date NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_country ON health_metrics(country);
CREATE INDEX IF NOT EXISTS idx_health_metrics_date ON health_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_metric ON health_metrics(metric_name);

-- Food & Agriculture Data (FAO, WFP, NASA, UN Comtrade, USDA)
CREATE TABLE IF NOT EXISTS food_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  iso_code text,
  source text NOT NULL, -- 'faostat', 'wfp', 'nasa_power', 'comtrade', 'usda'
  metric_name text NOT NULL,
  value numeric NOT NULL,
  unit text,
  crop text,
  ipc_phase integer, -- Integrated Food Security Phase Classification (1-5)
  date date NOT NULL,
  latitude numeric,
  longitude numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_data_country ON food_data(country);
CREATE INDEX IF NOT EXISTS idx_food_data_date ON food_data(date DESC);
CREATE INDEX IF NOT EXISTS idx_food_data_ipc ON food_data(ipc_phase);

-- Governance & Policy Data
CREATE TABLE IF NOT EXISTS governance_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  iso_code text,
  source text NOT NULL, -- 'vdem', 'transparency', 'worldbank', 'oecd', 'gdelt', 'factbook'
  indicator_name text NOT NULL,
  value numeric,
  category text, -- 'democracy', 'corruption', 'stability', 'debt', 'events'
  year integer NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_country ON governance_global(country);
CREATE INDEX IF NOT EXISTS idx_governance_year ON governance_global(year DESC);
CREATE INDEX IF NOT EXISTS idx_governance_category ON governance_global(category);

-- Population Data (UN WPP, WorldPop)
CREATE TABLE IF NOT EXISTS population_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  iso_code text NOT NULL,
  year integer NOT NULL,
  population bigint,
  projection_variant text, -- 'estimates', 'medium', 'high', 'low'
  age_group text,
  sex text,
  urban_percentage numeric,
  density_per_km2 numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(country, year, projection_variant, age_group, sex)
);

CREATE INDEX IF NOT EXISTS idx_population_country ON population_projection(country);
CREATE INDEX IF NOT EXISTS idx_population_year ON population_projection(year DESC);

-- Query Feedback for AI Training
CREATE TABLE IF NOT EXISTS query_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  query_text text NOT NULL,
  response_relevance float CHECK (response_relevance >= 0 AND response_relevance <= 1),
  top_apis jsonb NOT NULL, -- Array of {source, contribution_score}
  timestamp timestamptz DEFAULT now(),
  execution_time_ms integer,
  data_sources_used jsonb,
  user_satisfaction integer CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5)
);

CREATE INDEX IF NOT EXISTS idx_query_feedback_timestamp ON query_feedback(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_query_feedback_user ON query_feedback(user_id);

-- Global Vulnerability Scores (calculated from multiple sources)
CREATE TABLE IF NOT EXISTS vulnerability_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  iso_code text NOT NULL,
  overall_score numeric NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  health_risk numeric,
  food_risk numeric,
  energy_risk numeric,
  climate_risk numeric,
  economic_risk numeric,
  governance_risk numeric,
  population bigint,
  latitude numeric,
  longitude numeric,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  data_sources jsonb,
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vulnerability_country ON vulnerability_scores(country);
CREATE INDEX IF NOT EXISTS idx_vulnerability_score ON vulnerability_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_vulnerability_calculated ON vulnerability_scores(calculated_at DESC);

-- Autonomous Data Collection Triggers
CREATE TABLE IF NOT EXISTS data_collection_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name text NOT NULL,
  condition_type text NOT NULL, -- 'threshold', 'anomaly', 'schedule', 'event'
  condition_config jsonb NOT NULL,
  target_source text NOT NULL,
  target_endpoint text NOT NULL,
  priority text DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  enabled boolean DEFAULT true,
  last_triggered timestamptz,
  trigger_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triggers_enabled ON data_collection_triggers(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE finance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE population_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_collection_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Read access for authenticated users
CREATE POLICY finance_data_read ON finance_data FOR SELECT TO authenticated USING (true);
CREATE POLICY security_events_read ON security_events FOR SELECT TO authenticated USING (true);
CREATE POLICY health_metrics_read ON health_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY food_data_read ON food_data FOR SELECT TO authenticated USING (true);
CREATE POLICY governance_read ON governance_global FOR SELECT TO authenticated USING (true);
CREATE POLICY population_read ON population_projection FOR SELECT TO authenticated USING (true);
CREATE POLICY vulnerability_read ON vulnerability_scores FOR SELECT TO authenticated USING (true);

-- Query feedback - users can insert their own, admins can read all
CREATE POLICY query_feedback_insert ON query_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY query_feedback_read_own ON query_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY query_feedback_read_admin ON query_feedback FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers - only admins and operators
CREATE POLICY triggers_read ON data_collection_triggers FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));
CREATE POLICY triggers_manage ON data_collection_triggers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- System can insert data (for edge functions using service role)
CREATE POLICY finance_data_system_insert ON finance_data FOR INSERT WITH CHECK (true);
CREATE POLICY security_events_system_insert ON security_events FOR INSERT WITH CHECK (true);
CREATE POLICY health_metrics_system_insert ON health_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY food_data_system_insert ON food_data FOR INSERT WITH CHECK (true);
CREATE POLICY governance_system_insert ON governance_global FOR INSERT WITH CHECK (true);
CREATE POLICY population_system_insert ON population_projection FOR INSERT WITH CHECK (true);
CREATE POLICY vulnerability_system_insert ON vulnerability_scores FOR INSERT WITH CHECK (true);