-- Optional purchase provenance on each market-run shopping-list item.
-- Retains existing rows and does not alter established route names.
ALTER TABLE public.accra_run_items
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS receipt_reference text;
