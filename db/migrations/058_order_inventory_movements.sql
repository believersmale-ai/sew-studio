-- Trace each stock issue to a production order without changing historical stock movements.
alter table public.inventory_movements add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.inventory_movements add column if not exists unit_cost_at_movement numeric(14,2);
create index if not exists inventory_movements_order_idx on public.inventory_movements(shop_id,order_id,created_at desc) where order_id is not null;

-- An order-linked stock issue always belongs to the same studio as the item and order.
create or replace function public.validate_inventory_order_movement() returns trigger language plpgsql as $$
begin
  if new.order_id is not null then
    if new.movement_type not in ('issue','return') then
      raise exception 'Only stock issues and returns can be linked to orders';
    end if;
    if not exists (select 1 from public.orders where id=new.order_id and shop_id=new.shop_id) then
      raise exception 'Order not found in this studio';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists inventory_order_movement_validate on public.inventory_movements;
create trigger inventory_order_movement_validate before insert on public.inventory_movements
for each row execute function public.validate_inventory_order_movement();
