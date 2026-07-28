-- Personal OS: one JSON document of app state per Clerk user.
-- Run this in Supabase → SQL Editor for project gfpcdwjdxtgypizlzbkq
-- After running: Authentication → Third-party → add Clerk (from dashboard.clerk.com/setup/supabase)

create table if not exists public.user_app_state (
  user_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

drop policy if exists "Users can select own app state" on public.user_app_state;
create policy "Users can select own app state"
  on public.user_app_state
  for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "Users can insert own app state" on public.user_app_state;
create policy "Users can insert own app state"
  on public.user_app_state
  for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "Users can update own app state" on public.user_app_state;
create policy "Users can update own app state"
  on public.user_app_state
  for update
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);
