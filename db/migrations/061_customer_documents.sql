-- Private, tenant-scoped customer document metadata; binary files use existing uploads table.
create table if not exists public.customer_documents (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.shops(id) on delete cascade,
 customer_id uuid not null references public.customers(id) on delete cascade,
 upload_id uuid not null references public.uploads(id) on delete cascade,
 name text not null,
 category text not null check (category in ('sketch','invoice','quotation','fitting_photo','other')),
 created_at timestamptz not null default now()
);
create index if not exists customer_documents_lookup_idx on public.customer_documents(shop_id,customer_id,created_at desc);
alter table public.customer_documents enable row level security;
create policy "customer docs studio read" on public.customer_documents for select using (shop_id = public.current_shop_id());
create policy "customer docs studio insert" on public.customer_documents for insert with check (shop_id = public.current_shop_id());
create policy "customer docs studio delete" on public.customer_documents for delete using (shop_id = public.current_shop_id());
