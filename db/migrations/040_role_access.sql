-- 040: Per-role access overrides, edited by a platform admin in /admin/roles.
--
-- A row says what one studio role may do on one menu/tool, overriding the
-- built-in default (see src/lib/role-access.ts). The studio owner ("madam") is
-- never restricted. Contacts and Asset Register default to owner-only.
create table if not exists public.system_role_access (
  role text not null check (role in ('madam', 'staff', 'trainer', 'trainee', 'freelancer')),
  menu_key text not null check (menu_key ~ '^[a-z-]{2,30}$'),
  can_view boolean not null default true,
  can_edit boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.system_admins (id) on delete set null,
  primary key (role, menu_key)
);
alter table public.system_role_access enable row level security;
revoke all on public.system_role_access from anon, authenticated, service_role;
