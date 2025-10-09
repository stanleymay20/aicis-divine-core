-- Create exchange_accounts table
CREATE TABLE IF NOT EXISTS public.exchange_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  balance_usd NUMERIC NOT NULL DEFAULT 0,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exchange_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exchange accounts viewable by authenticated users"
  ON public.exchange_accounts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and operators can manage exchange accounts"
  ON public.exchange_accounts
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Create revenue_streams table
CREATE TABLE IF NOT EXISTS public.revenue_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division TEXT NOT NULL,
  source TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.revenue_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Revenue streams viewable by authenticated users"
  ON public.revenue_streams
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and operators can insert revenue streams"
  ON public.revenue_streams
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Create ai_reports table
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  division TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI reports viewable by authenticated users"
  ON public.ai_reports
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and operators can create AI reports"
  ON public.ai_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_exchange_accounts_updated_at
  BEFORE UPDATE ON public.exchange_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default exchange accounts
INSERT INTO public.exchange_accounts (exchange, status, balance_usd) VALUES
  ('Binance', 'active', 125000.00),
  ('Coinbase', 'active', 89000.00),
  ('OKX', 'active', 67000.00)
ON CONFLICT DO NOTHING;