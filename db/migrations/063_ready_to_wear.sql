-- Ready-to-wear catalog and order intake. No payment is marked paid without verification.
create table if not exists public.rtw_products (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.shops(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 180),
 description text not null default '',
 category text not null default 'Dresses',
 price numeric(12,2) not null check (price >= 0),
 image_url text,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.rtw_variants (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.rtw_products(id) on delete cascade,
 size text not null,
 color text not null,
 stock integer not null default 0 check (stock >= 0),
 unique(product_id,size,color)
);
create table if not exists public.rtw_orders (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.shops(id) on delete cascade,
 product_id uuid not null references public.rtw_products(id),
 variant_id uuid not null references public.rtw_variants(id),
 quantity integer not null check(quantity between 1 and 20),
 unit_price numeric(12,2) not null check(unit_price >= 0),
 total numeric(12,2) not null check(total >= 0),
 customer_name text not null,
 customer_phone text not null,
 customer_email text,
 delivery_address text not null,
 delivery_city text not null,
 delivery_notes text,
 status text not null default 'Pending payment' check(status in ('Pending payment','Paid','Processing','Dispatched','Delivered','Cancelled')),
 payment_status text not null default 'Unpaid' check(payment_status in ('Unpaid','Pending verification','Paid','Refunded')),
 created_at timestamptz not null default now()
);
create index if not exists rtw_products_shop on public.rtw_products(shop_id,published);
create index if not exists rtw_orders_shop on public.rtw_orders(shop_id,created_at desc);
alter table public.rtw_products enable row level security;
alter table public.rtw_variants enable row level security;
alter table public.rtw_orders enable row level security;
create policy "studio catalog read" on public.rtw_products for select using (shop_id=public.current_shop_id());
create policy "studio catalog write" on public.rtw_products for all using (shop_id=public.current_shop_id()) with check (shop_id=public.current_shop_id());
create policy "studio variants read" on public.rtw_variants for select using (exists(select 1 from public.rtw_products p where p.id=product_id and p.shop_id=public.current_shop_id()));
create policy "studio variants write" on public.rtw_variants for all using (exists(select 1 from public.rtw_products p where p.id=product_id and p.shop_id=public.current_shop_id())) with check (exists(select 1 from public.rtw_products p where p.id=product_id and p.shop_id=public.current_shop_id()));
create policy "studio rtw orders read" on public.rtw_orders for select using (shop_id=public.current_shop_id());
