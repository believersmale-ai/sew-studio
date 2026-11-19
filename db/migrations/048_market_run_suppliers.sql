-- Reusable supplier directory scoped to the studio.
CREATE TABLE IF NOT EXISTS public.market_run_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, name)
);
CREATE INDEX IF NOT EXISTS market_run_suppliers_shop_idx ON public.market_run_suppliers(shop_id);
ALTER TABLE public.market_run_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read" ON public.market_run_suppliers FOR SELECT USING (shop_id = public.current_shop_id());
CREATE POLICY "shop members insert" ON public.market_run_suppliers FOR INSERT WITH CHECK (shop_id = public.current_shop_id());
CREATE POLICY "shop members update" ON public.market_run_suppliers FOR UPDATE USING (shop_id = public.current_shop_id()) WITH CHECK (shop_id = public.current_shop_id());
CREATE POLICY "shop members delete" ON public.market_run_suppliers FOR DELETE USING (shop_id = public.current_shop_id());
