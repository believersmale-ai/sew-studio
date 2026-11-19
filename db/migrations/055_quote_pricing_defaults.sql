-- Studio-specific quotation defaults. Existing saved quotes remain untouched.
alter table public.settings add column if not exists quote_garment_labour jsonb;
alter table public.settings add column if not exists quote_complexity_levels jsonb;
