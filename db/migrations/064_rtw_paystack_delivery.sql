-- Paystack transaction identity, verification and delivery workflow.
alter table public.rtw_orders add column if not exists payment_reference text unique;
alter table public.rtw_orders add column if not exists paid_at timestamptz;
alter table public.rtw_orders add column if not exists delivery_fee numeric(12,2) not null default 0 check(delivery_fee>=0);
alter table public.rtw_orders add column if not exists courier text;
alter table public.rtw_orders add column if not exists tracking_number text;
alter table public.rtw_orders add column if not exists dispatched_at timestamptz;
alter table public.rtw_orders add column if not exists delivered_at timestamptz;
alter table public.rtw_orders add column if not exists updated_at timestamptz not null default now();
create index if not exists rtw_orders_reference_idx on public.rtw_orders(payment_reference) where payment_reference is not null;
