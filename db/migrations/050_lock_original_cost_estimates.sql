-- Lock the original quote and estimated breakdown at the database level.
-- Actual costs can be updated as production is reconciled; original terms cannot.
CREATE OR REPLACE FUNCTION public.prevent_reconciliation_estimate_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
    OR NEW.quote_id IS DISTINCT FROM OLD.quote_id
    OR NEW.quoted_price IS DISTINCT FROM OLD.quoted_price
    OR NEW.estimated_lines IS DISTINCT FROM OLD.estimated_lines
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Original quoted price and estimated costs are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_reconciliation_estimate_changes ON public.order_cost_reconciliations;
CREATE TRIGGER prevent_reconciliation_estimate_changes
BEFORE UPDATE ON public.order_cost_reconciliations
FOR EACH ROW EXECUTE FUNCTION public.prevent_reconciliation_estimate_changes();
