-- =====================================================
-- AICIS DATABASE SCHEMA
-- Autonomous Intelligent Cybernetic Intervention System
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USER ROLES & PROFILES
-- =====================================================

-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'observer');

-- User roles table (CRITICAL: separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'observer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- User profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Assign default observer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'observer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. AI DIVISIONS STATUS
-- =====================================================

CREATE TYPE public.division_status AS ENUM ('optimal', 'operational', 'active', 'degraded', 'offline');

CREATE TABLE public.ai_divisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    division_key TEXT NOT NULL UNIQUE,
    status division_status NOT NULL DEFAULT 'operational',
    uptime_percentage NUMERIC(5,2) NOT NULL DEFAULT 99.99,
    performance_score NUMERIC(5,2) NOT NULL DEFAULT 95.00,
    last_check TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_divisions ENABLE ROW LEVEL SECURITY;

-- AI Divisions are publicly readable
CREATE POLICY "AI divisions are viewable by authenticated users"
  ON public.ai_divisions FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update division status
CREATE POLICY "Admins can update divisions"
  ON public.ai_divisions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default divisions
INSERT INTO public.ai_divisions (name, division_key, status, uptime_percentage, performance_score) VALUES
('Financial Intelligence', 'finance', 'operational', 99.99, 97.5),
('Military & Security', 'security', 'active', 100.00, 98.2),
('Healthcare Division', 'healthcare', 'operational', 99.95, 96.8),
('Food & Agriculture', 'agriculture', 'operational', 99.87, 95.3),
('Energy & Infrastructure', 'energy', 'optimal', 99.99, 98.9),
('Governance & Policy', 'governance', 'operational', 99.92, 94.7),
('Cybersecurity Intelligence', 'cybersecurity', 'active', 100.00, 99.1),
('J.A.R.V.I.S. Interface', 'assistant', 'active', 99.99, 99.5);

-- =====================================================
-- 3. FINANCIAL TRADING DATA
-- =====================================================

CREATE TYPE public.trade_side AS ENUM ('buy', 'sell');
CREATE TYPE public.trade_status AS ENUM ('pending', 'executed', 'failed', 'cancelled');

CREATE TABLE public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exchange TEXT NOT NULL,
    pair TEXT NOT NULL,
    side trade_side NOT NULL,
    amount NUMERIC(20,8) NOT NULL,
    price NUMERIC(20,8) NOT NULL,
    profit NUMERIC(20,8),
    status trade_status NOT NULL DEFAULT 'pending',
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trades are viewable by authenticated users"
  ON public.trades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and operators can insert trades"
  ON public.trades FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'operator')
  );

-- =====================================================
-- 4. SECURITY & THREAT LOGS
-- =====================================================

CREATE TYPE public.threat_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.threat_type AS ENUM ('cyber', 'physical', 'network', 'data_breach', 'intrusion', 'malware');

CREATE TABLE public.threat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_type threat_type NOT NULL,
    severity threat_severity NOT NULL,
    location TEXT,
    description TEXT,
    neutralized BOOLEAN NOT NULL DEFAULT false,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

ALTER TABLE public.threat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Threat logs viewable by authenticated users"
  ON public.threat_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage threat logs"
  ON public.threat_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 5. HEALTHCARE DATA
-- =====================================================

CREATE TYPE public.health_risk_level AS ENUM ('minimal', 'low', 'moderate', 'high', 'critical');

CREATE TABLE public.health_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region TEXT NOT NULL,
    disease TEXT NOT NULL,
    risk_level health_risk_level NOT NULL,
    affected_count INTEGER NOT NULL DEFAULT 0,
    mortality_rate NUMERIC(5,2),
    containment_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.health_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Health data viewable by authenticated users"
  ON public.health_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage health data"
  ON public.health_data FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 6. FOOD SECURITY & AGRICULTURE
-- =====================================================

CREATE TYPE public.alert_level AS ENUM ('stable', 'monitoring', 'warning', 'critical', 'emergency');

CREATE TABLE public.food_security (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region TEXT NOT NULL,
    crop TEXT NOT NULL,
    yield_index NUMERIC(5,2) NOT NULL,
    alert_level alert_level NOT NULL DEFAULT 'stable',
    supply_days INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.food_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Food security data viewable by authenticated users"
  ON public.food_security FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage food security data"
  ON public.food_security FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 7. ENERGY GRID MANAGEMENT
-- =====================================================

CREATE TYPE public.stability_status AS ENUM ('stable', 'fluctuating', 'stressed', 'critical', 'failure');

CREATE TABLE public.energy_grid (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region TEXT NOT NULL,
    grid_load NUMERIC(5,2) NOT NULL,
    capacity NUMERIC(10,2) NOT NULL,
    stability_index NUMERIC(5,2) NOT NULL,
    renewable_percentage NUMERIC(5,2),
    outage_risk stability_status NOT NULL DEFAULT 'stable',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.energy_grid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Energy grid data viewable by authenticated users"
  ON public.energy_grid FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage energy data"
  ON public.energy_grid FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 8. SYSTEM LOGS & AUDIT TRAIL
-- =====================================================

CREATE TYPE public.log_level AS ENUM ('info', 'warning', 'error', 'critical', 'success');

CREATE TABLE public.system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    division TEXT,
    action TEXT NOT NULL,
    result TEXT,
    log_level log_level NOT NULL DEFAULT 'info',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System logs viewable by authenticated users"
  ON public.system_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert logs"
  ON public.system_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- =====================================================
-- 9. COMMAND HISTORY (J.A.R.V.I.S.)
-- =====================================================

CREATE TABLE public.command_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    response TEXT,
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.command_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own command history"
  ON public.command_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own commands"
  ON public.command_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all command history"
  ON public.command_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 10. AUTO-UPDATE TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_divisions_updated_at
    BEFORE UPDATE ON public.ai_divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_health_data_updated_at
    BEFORE UPDATE ON public.health_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_food_security_updated_at
    BEFORE UPDATE ON public.food_security
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_energy_grid_updated_at
    BEFORE UPDATE ON public.energy_grid
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- AICIS DATABASE COMPLETE
-- All tables secured with RLS
-- Role-based access control implemented
-- Auto-timestamping enabled
-- =====================================================