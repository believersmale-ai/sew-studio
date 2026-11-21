-- Customer interaction timeline. Additive, studio-scoped and safe for existing data.
create table if not exists public.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null check (kind in ('call','message','appointment','visit','note')),
  subject text not null check (char_length(subject) between 1 and 200),
  details text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists customer_interactions_customer_idx on public.customer_interactions(shop_id,customer_id,occurred_at desc);
alter table public.customer_interactions enable row level security;
create policy "customer interactions studio read" on public.customer_interactions for select using (shop_id = public.current_shop_id());
create policy "customer interactions studio insert" on public.customer_interactions for insert with check (shop_id = public.current_shop_id());
create policy "customer interactions studio delete" on public.customer_interactions for delete using (shop_id = public.current_shop_id());
