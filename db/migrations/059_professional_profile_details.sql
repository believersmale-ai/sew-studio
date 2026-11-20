-- Optional professional details shown on staff and freelancer profiles.
alter table public.profiles add column if not exists certification text;
alter table public.profiles add column if not exists years_experience integer;
alter table public.profiles add column if not exists country text;
alter table public.freelancer_profiles add column if not exists certification text;
alter table public.freelancer_profiles add column if not exists years_experience integer;
alter table public.freelancer_profiles add column if not exists country text;
