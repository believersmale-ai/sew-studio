-- 041: Several platform admins with different responsibilities.
--
-- A "super" admin (the original admin) can do everything, including managing
-- other admins. Other admins are limited to the areas ticked for them
-- (see src/lib/admin-access.ts). Admins that existed before this migration
-- become super admins so nobody loses access.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'system_admins' and column_name = 'is_super'
  ) then
    alter table public.system_admins add column is_super boolean not null default false;
    update public.system_admins set is_super = true;
  end if;
end $$;

alter table public.system_admins add column if not exists areas text[] not null default '{}';
alter table public.system_admins add column if not exists disabled_at timestamptz;
alter table public.system_admins add column if not exists created_by uuid references public.system_admins (id) on delete set null;
