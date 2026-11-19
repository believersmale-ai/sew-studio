-- Consumable studio stock is separate from durable assets and maintenance.
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sku text,
  category text not null default 'Other',
  unit text not null default 'pcs',
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  location text,
  supplier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_name_unique unique(shop_id, name),
  constraint inventory_sku_unique unique(shop_id, sku)
);
create index if not exists inventory_items_shop_category_idx on public.inventory_items(shop_id, category);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check(movement_type in ('opening','receive','issue','adjustment','return')),
  quantity_delta numeric(14,3) not null check(quantity_delta <> 0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_item_date_idx on public.inventory_movements(item_id,created_at desc);
create or replace function public.apply_inventory_movement() returns trigger language plpgsql as $$
begin
  if new.movement_type = 'opening' then
    raise exception 'Opening balance is recorded automatically when an item is created';
  end if;
  update public.inventory_items set quantity=quantity+new.quantity_delta,updated_at=now()
  where id=new.item_id and shop_id=new.shop_id and quantity+new.quantity_delta>=0;
  if not found then raise exception 'Insufficient stock or item not found in studio'; end if;
  return new;
end $$;
drop trigger if exists inventory_movement_apply on public.inventory_movements;
create trigger inventory_movement_apply before insert on public.inventory_movements
for each row execute function public.apply_inventory_movement();
-- Stock movements are immutable; corrections are new adjustment movements.
create or replace function public.prevent_inventory_movement_change() returns trigger language plpgsql as $$
begin raise exception 'Inventory movement history is immutable'; end $$;
drop trigger if exists inventory_movement_immutable on public.inventory_movements;
create trigger inventory_movement_immutable before update or delete on public.inventory_movements
for each row execute function public.prevent_inventory_movement_change();

-- Initial quantity and its audit entry are committed in the same transaction.
-- This AFTER INSERT trigger creates the opening movement without double-counting it.
create or replace function public.record_inventory_opening_balance() returns trigger language plpgsql as $$
begin
  if new.quantity > 0 then
    insert into public.inventory_movements (shop_id,item_id,movement_type,quantity_delta,note)
    values (new.shop_id,new.id,'opening',new.quantity,'Opening balance');
  end if;
  return new;
end $$;
-- The opening trigger must bypass the ordinary movement stock-update trigger.
create or replace function public.apply_inventory_movement() returns trigger language plpgsql as $$
begin
  if new.movement_type = 'opening' then
    return new;
  end if;
  update public.inventory_items set quantity=quantity+new.quantity_delta,updated_at=now()
  where id=new.item_id and shop_id=new.shop_id and quantity+new.quantity_delta>=0;
  if not found then raise exception 'Insufficient stock or item not found in studio'; end if;
  return new;
end $$;
drop trigger if exists inventory_opening_balance on public.inventory_items;
create trigger inventory_opening_balance after insert on public.inventory_items
for each row execute function public.record_inventory_opening_balance();
