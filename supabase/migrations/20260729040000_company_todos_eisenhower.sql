-- Eisenhower matrix, notes, and nested subtasks for company_tasks
-- Project: gfpcdwjdxtgypizlzbkq (Personal OS)

-- Notes on each task
alter table public.company_tasks
  add column if not exists notes text not null default '';

-- Nested subtasks (null = top-level task)
alter table public.company_tasks
  add column if not exists parent_id uuid references public.company_tasks (id) on delete cascade;

create index if not exists company_tasks_parent_id_idx
  on public.company_tasks (parent_id);

-- Migrate HPA → Eisenhower quadrants
update public.company_tasks set priority = 'do' where priority = 'hpa1';
update public.company_tasks set priority = 'schedule' where priority = 'hpa2';
update public.company_tasks set priority = 'delegate' where priority = 'hpa3';

-- Replace priority check constraint
alter table public.company_tasks drop constraint if exists company_tasks_priority_check;
alter table public.company_tasks
  add constraint company_tasks_priority_check
  check (priority in ('do', 'schedule', 'delegate', 'eliminate'));
