-- Batcave company to-dos (run in Supabase SQL Editor)
-- RLS: each Clerk user only sees their own tasks

create table if not exists public.company_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  priority text not null check (priority in ('hpa1', 'hpa2', 'hpa3')),
  status text not null check (status in ('not_started', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_tasks_user_id_idx on public.company_tasks (user_id);
create index if not exists company_tasks_user_priority_idx on public.company_tasks (user_id, priority);

create table if not exists public.company_task_dependencies (
  blocked_task_id uuid not null references public.company_tasks (id) on delete cascade,
  blocking_task_id uuid not null references public.company_tasks (id) on delete cascade,
  primary key (blocked_task_id, blocking_task_id),
  check (blocked_task_id <> blocking_task_id)
);

alter table public.company_tasks enable row level security;
alter table public.company_task_dependencies enable row level security;

drop policy if exists "Users manage own company tasks" on public.company_tasks;
create policy "Users manage own company tasks"
  on public.company_tasks
  for all
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "Users manage own company task deps" on public.company_task_dependencies;
create policy "Users manage own company task deps"
  on public.company_task_dependencies
  for all
  to authenticated
  using (
    exists (
      select 1 from public.company_tasks t
      where t.id = blocked_task_id
        and t.user_id = (select auth.jwt()->>'sub')
    )
  )
  with check (
    exists (
      select 1 from public.company_tasks t
      where t.id = blocked_task_id
        and t.user_id = (select auth.jwt()->>'sub')
    )
    and exists (
      select 1 from public.company_tasks t
      where t.id = blocking_task_id
        and t.user_id = (select auth.jwt()->>'sub')
    )
  );
