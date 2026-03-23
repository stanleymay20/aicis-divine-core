
-- 1. Add compared_to_version to decision_models if missing
ALTER TABLE public.decision_models ADD COLUMN IF NOT EXISTS compared_to_version text;

-- 2. Add execution_owner to decision_outcome_log if missing
ALTER TABLE public.decision_outcome_log ADD COLUMN IF NOT EXISTS execution_owner text;

-- 3. Create weekly_learning_logs table
CREATE TABLE IF NOT EXISTS public.weekly_learning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_started_at timestamptz NOT NULL DEFAULT now(),
  run_finished_at timestamptz,
  success boolean NOT NULL DEFAULT false,
  calibration_version text,
  evaluation_result jsonb,
  governance_alerts_triggered int DEFAULT 0,
  weekly_stats jsonb,
  error_message text,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_learning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read weekly_learning_logs"
  ON public.weekly_learning_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert weekly_learning_logs"
  ON public.weekly_learning_logs FOR INSERT TO service_role WITH CHECK (true);

-- 4. Create subscription_tiers table
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price_monthly numeric NOT NULL DEFAULT 0,
  stripe_price_id text,
  features jsonb DEFAULT '[]'::jsonb,
  max_decisions_per_month int DEFAULT 100,
  max_domains int DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subscription_tiers"
  ON public.subscription_tiers FOR SELECT TO authenticated USING (true);

-- 5. Add RLS policy for audit_log inserts by service_role
CREATE POLICY "Service role can insert audit_log"
  ON public.audit_log FOR INSERT TO service_role WITH CHECK (true);

-- 6. Add RLS for billing_events reads
CREATE POLICY "Authenticated can read billing_events"
  ON public.billing_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert billing_events"
  ON public.billing_events FOR INSERT TO service_role WITH CHECK (true);

-- 7. Ensure governance_discrepancies has RLS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'governance_discrepancies' AND policyname = 'Authenticated can read governance_discrepancies') THEN
    CREATE POLICY "Authenticated can read governance_discrepancies"
      ON public.governance_discrepancies FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'governance_discrepancies' AND policyname = 'Service role can insert governance_discrepancies') THEN
    CREATE POLICY "Service role can insert governance_discrepancies"
      ON public.governance_discrepancies FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

-- 8. Ensure silent_failure_state has proper RLS for service_role writes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'silent_failure_state' AND policyname = 'Service role manage silent_failure_state') THEN
    CREATE POLICY "Service role manage silent_failure_state"
      ON public.silent_failure_state FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
