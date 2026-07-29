-- Manual sort order + hide/blur for company tasks
-- Project: Personal OS (Batcave)

alter table public.company_tasks
  add column if not exists sort_order integer not null default 0;

alter table public.company_tasks
  add column if not exists hidden boolean not null default false;

-- Backfill sort_order from created_at (stable per-user ordering)
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at asc, id asc
    ) - 1 as rn
  from public.company_tasks
  where parent_id is null
)
update public.company_tasks t
set sort_order = ranked.rn
from ranked
where t.id = ranked.id;

create index if not exists company_tasks_user_sort_idx
  on public.company_tasks (user_id, sort_order);
