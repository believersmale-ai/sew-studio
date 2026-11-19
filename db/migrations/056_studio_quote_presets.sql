-- Shared quotation suggestions are scoped to the studio, not a browser.
alter table public.settings add column if not exists quote_item_presets jsonb;
alter table public.settings add column if not exists quote_extra_presets jsonb;
