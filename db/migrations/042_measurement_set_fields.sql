-- 042: the columns the measurement form already writes.
-- The app saves the extended (ISO 8559-1) measurements as one jsonb value, plus a
-- set name, garment type, status, customer approval, shoulder slope and free-text
-- custom measurements. No earlier migration created them, so every "Save session"
-- failed with: column "extended" of relation "measurement_sets" does not exist.
-- Additive and safe to run more than once. Existing rows get the same defaults the
-- app already assumes when a value is missing.
alter table public.measurement_sets
  add column if not exists extended            jsonb not null default '{}'::jsonb,
  add column if not exists custom_measurements text,
  add column if not exists set_name            text,
  add column if not exists shoulder_slope      text
    check (shoulder_slope is null or shoulder_slope in ('Square', 'Normal', 'Sloping', 'Uneven', 'Custom')),
  add column if not exists garment_type        text not null default 'General'
    check (garment_type in ('General', 'Dress', 'Top', 'Skirt', 'Trousers', 'Bridal')),
  add column if not exists status              text not null default 'Confirmed'
    check (status in ('Draft', 'Confirmed')),
  add column if not exists customer_approval   text not null default 'Pending'
    check (customer_approval in ('Pending', 'Approved'));
