-- Add metadata columns for Phase 7 data connectors
ALTER TABLE revenue_streams ADD COLUMN IF NOT EXISTS meta JSONB;
ALTER TABLE food_security ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE health_data ADD COLUMN IF NOT EXISTS severity_index NUMERIC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenue_streams_timestamp ON revenue_streams(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_energy_grid_updated ON energy_grid(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_data_updated ON health_data(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_security_updated ON food_security(updated_at DESC);