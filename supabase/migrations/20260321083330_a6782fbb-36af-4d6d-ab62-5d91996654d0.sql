-- Enable RLS on intelligence_score_snapshots
ALTER TABLE intelligence_score_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read access (this is public intelligence data)
CREATE POLICY "Anyone can read intelligence scores"
  ON intelligence_score_snapshots FOR SELECT
  USING (true);