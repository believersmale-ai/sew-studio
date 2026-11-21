-- Manual payments remain unverified until the studio owner confirms receipt.
alter table public.rtw_orders add column if not exists payment_method text not null default 'paystack'
 check(payment_method in ('paystack','manual'));
alter table public.rtw_orders add column if not exists manual_payment_channel text
 check(manual_payment_channel in ('Mobile Money','Bank transfer','Cash on delivery'));
alter table public.rtw_orders add column if not exists manual_payment_reference text;
alter table public.rtw_orders add column if not exists manual_payment_note text;
alter table public.rtw_orders add column if not exists manual_payment_submitted_at timestamptz;
alter table public.rtw_orders add column if not exists manual_payment_verified_at timestamptz;
alter table public.rtw_orders add column if not exists manual_payment_verified_by uuid;
create index if not exists rtw_manual_pending_idx on public.rtw_orders(shop_id,created_at desc)
 where payment_method='manual' and payment_status <> 'Paid';
