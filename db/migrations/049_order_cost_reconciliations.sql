-- Immutable agreed-price and estimated-cost snapshot, followed by owner-entered actual costs.
CREATE TABLE IF NOT EXISTS public.order_cost_reconciliations (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  quoted_price numeric(12,2) NOT NULL CHECK(quoted_price>=0),
  estimated_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  actual_lines jsonb,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_cost_reconciliations_shop_idx ON public.order_cost_reconciliations(shop_id);
ALTER TABLE public.order_cost_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads reconciliation" ON public.order_cost_reconciliations FOR SELECT USING (shop_id=public.current_shop_id() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND shop_id=order_cost_reconciliations.shop_id AND role='madam'));
CREATE POLICY "owner inserts reconciliation" ON public.order_cost_reconciliations FOR INSERT WITH CHECK (shop_id=public.current_shop_id() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND shop_id=order_cost_reconciliations.shop_id AND role='madam'));
CREATE POLICY "owner updates reconciliation" ON public.order_cost_reconciliations FOR UPDATE USING (shop_id=public.current_shop_id() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND shop_id=order_cost_reconciliations.shop_id AND role='madam')) WITH CHECK (shop_id=public.current_shop_id());
