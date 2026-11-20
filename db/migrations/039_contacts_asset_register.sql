-- 039: Contacts (suppliers + artisans) and the Asset Register
-- (assigned staff, notes and a maintenance history per asset).

-- 1. Menu keys so a platform admin can switch each page on/off.
alter table public.system_menu_settings
  drop constraint if exists system_menu_settings_menu_key_check;
alter table public.system_menu_settings
  add constraint system_menu_settings_menu_key_check check (menu_key in (
    'dashboard', 'customers', 'orders', 'board', 'fittings', 'tasks',
    'quote', 'costing', 'payments', 'projection', 'accra-runs', 'assets',
    'contacts', 'asset-register', 'webinars',
    'style-assist', 'team', 'community', 'curriculum',
    'progress', 'portfolio', 'certificate', 'messages', 'my-jobs', 'settings'
  ));
insert into public.system_menu_settings (menu_key)
values ('contacts'), ('asset-register')
on conflict (menu_key) do nothing;

-- 2. Suppliers (who you buy from) and artisans (who fixes things).
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  supplies text,
  location text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_shop_idx on public.suppliers (shop_id, name);

create table if not exists public.artisans (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  trade text not null default 'Other',
  phone text,
  location text,
  rate_note text,
  last_used date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists artisans_shop_idx on public.artisans (shop_id, name);

-- 3. Asset Register additions.
alter table public.assets add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
alter table public.assets add column if not exists notes text;

create table if not exists public.asset_maintenance (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  serviced_on date not null default current_date,
  performed_by text,
  cost numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists asset_maintenance_asset_idx on public.asset_maintenance (asset_id, serviced_on desc);

-- 4. Row-level security: a studio only ever sees its own rows.
do $$
declare t text;
begin
  foreach t in array array['suppliers', 'artisans', 'asset_maintenance'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "shop members read" on public.%I', t);
    execute format('drop policy if exists "shop members insert" on public.%I', t);
    execute format('drop policy if exists "shop members update" on public.%I', t);
    execute format('drop policy if exists "shop members delete" on public.%I', t);
    execute format('create policy "shop members read" on public.%I for select using (shop_id = public.current_shop_id())', t);
    execute format('create policy "shop members insert" on public.%I for insert with check (shop_id = public.current_shop_id())', t);
    execute format('create policy "shop members update" on public.%I for update using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id())', t);
    execute format('create policy "shop members delete" on public.%I for delete using (shop_id = public.current_shop_id())', t);
  end loop;
end $$;

drop trigger if exists set_updated_at on public.suppliers;
create trigger set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.artisans;
create trigger set_updated_at before update on public.artisans
  for each row execute function public.set_updated_at();
