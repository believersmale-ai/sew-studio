-- Shared, database-backed rate limits for public ready-to-wear endpoints.
create table if not exists public.rtw_request_limits (
  bucket text primary key,
  count integer not null default 0,
  expires_at timestamptz not null
);
create index if not exists rtw_request_limits_expiry on public.rtw_request_limits(expires_at);
revoke all on public.rtw_request_limits from public;
