import type { CompanyTask, CompanyTaskPriority, CompanyTaskStatus } from '@/types'
import { createClerkSupabaseClient } from './browser'

type TokenSession = { getToken: () => Promise<string | null> }

type TaskRow = {
  id: string
  user_id: string
  title: string
  priority: CompanyTaskPriority
  status: CompanyTaskStatus
  created_at: string
  updated_at: string
}

function mapTask(row: TaskRow, blockedByIds: string[]): CompanyTask {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    blockedByIds,
  }
}

export async function listCompanyTasks(session: TokenSession, userId: string): Promise<CompanyTask[]> {
  const client = createClerkSupabaseClient(() => session.getToken())
  if (!client) throw new Error('Supabase is not configured')

  const { data: tasks, error } = await client
    .from('company_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const ids = (tasks || []).map((t) => t.id as string)
  let deps: { blocked_task_id: string; blocking_task_id: string }[] = []
  if (ids.length) {
    const { data: depRows, error: depError } = await client
      .from('company_task_dependencies')
      .select('blocked_task_id, blocking_task_id')
      .in('blocked_task_id', ids)
    if (depError) throw new Error(depError.message)
    deps = (depRows || []) as typeof deps
  }

  const byBlocked = new Map<string, string[]>()
  for (const d of deps) {
    const list = byBlocked.get(d.blocked_task_id) || []
    list.push(d.blocking_task_id)
    byBlocked.set(d.blocked_task_id, list)
  }

  return (tasks || []).map((row) => mapTask(row as TaskRow, byBlocked.get(row.id as string) || []))
}

export async function createCompanyTask(
  session: TokenSession,
  input: {
    userId: string
    title: string
    priority: CompanyTaskPriority
    blockedByIds?: string[]
  },
): Promise<CompanyTask> {
  const client = createClerkSupabaseClient(() => session.getToken())
  if (!client) throw new Error('Supabase is not configured')

  const { data, error } = await client
    .from('company_tasks')
    .insert({
      user_id: input.userId,
      title: input.title.trim(),
      priority: input.priority,
      status: 'not_started',
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  const blockedByIds = [...new Set((input.blockedByIds || []).filter(Boolean))]
  if (blockedByIds.length) {
    const { error: depError } = await client.from('company_task_dependencies').insert(
      blockedByIds.map((blocking_task_id) => ({
        blocked_task_id: data.id,
        blocking_task_id,
      })),
    )
    if (depError) throw new Error(depError.message)
  }

  return mapTask(data as TaskRow, blockedByIds)
}

export async function updateCompanyTask(
  session: TokenSession,
  taskId: string,
  patch: Partial<{
    title: string
    priority: CompanyTaskPriority
    status: CompanyTaskStatus
    blockedByIds: string[]
  }>,
): Promise<void> {
  const client = createClerkSupabaseClient(() => session.getToken())
  if (!client) throw new Error('Supabase is not configured')

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof patch.title === 'string') updates.title = patch.title.trim()
  if (patch.priority) updates.priority = patch.priority
  if (patch.status) updates.status = patch.status

  if (Object.keys(updates).length > 1) {
    const { error } = await client.from('company_tasks').update(updates).eq('id', taskId)
    if (error) throw new Error(error.message)
  }

  if (patch.blockedByIds) {
    const next = [...new Set(patch.blockedByIds.filter((id) => id && id !== taskId))]
    const { error: delError } = await client
      .from('company_task_dependencies')
      .delete()
      .eq('blocked_task_id', taskId)
    if (delError) throw new Error(delError.message)
    if (next.length) {
      const { error: insError } = await client.from('company_task_dependencies').insert(
        next.map((blocking_task_id) => ({
          blocked_task_id: taskId,
          blocking_task_id,
        })),
      )
      if (insError) throw new Error(insError.message)
    }
  }
}

export async function deleteCompanyTask(session: TokenSession, taskId: string): Promise<void> {
  const client = createClerkSupabaseClient(() => session.getToken())
  if (!client) throw new Error('Supabase is not configured')
  const { error } = await client.from('company_tasks').delete().eq('id', taskId)
  if (error) throw new Error(error.message)
}
