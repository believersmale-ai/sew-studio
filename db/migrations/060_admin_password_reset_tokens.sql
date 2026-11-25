create table if not exists private.admin_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_password_reset_tokens_admin_idx on private.admin_password_reset_tokens(admin_id);
create index if not exists admin_password_reset_tokens_expiry_idx on private.admin_password_reset_tokens(expires_at);
