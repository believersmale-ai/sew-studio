-- Customer alterations linked to an existing order, scoped to one studio.
create table if not exists public.customer_alterations (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.shops(id) on delete cascade,
 customer_id uuid not null references public.customers(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 description text not null check (char_length(description) between 1 and 2000),
 status text not null default 'Requested' check (status in ('Requested','Assigned','In Progress','Ready','Completed','Cancelled')),
 assigned_to uuid references public.profiles(id) on delete set null,
 due_date date,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists customer_alterations_lookup on public.customer_alterations(shop_id,customer_id,created_at desc);
alter table public.customer_alterations enable row level security;
create policy "customer alterations read" on public.customer_alterations for select using (shop_id=public.current_shop_id());
create policy "customer alterations insert" on public.customer_alterations for insert with check (shop_id=public.current_shop_id());
create policy "customer alterations update" on public.customer_alterations for update using (shop_id=public.current_shop_id()) with check (shop_id=public.current_shop_id());
