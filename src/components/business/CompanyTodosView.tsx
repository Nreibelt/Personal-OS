'use client'

import { useAuth, useSession } from '@clerk/nextjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { HudPanel } from '../HudPanel'
import {
  createCompanyTask,
  deleteCompanyTask,
  listCompanyTasks,
  updateCompanyTask,
} from '../../lib/supabase/companyTodos'
import type { CompanyTask, CompanyTaskPriority, CompanyTaskStatus } from '../../types'

const PRIORITY_META: Record<
  CompanyTaskPriority,
  { label: string; className: string; order: number }
> = {
  hpa1: { label: 'HPA 1', className: 'hpa1', order: 1 },
  hpa2: { label: 'HPA 2', className: 'hpa2', order: 2 },
  hpa3: { label: 'HPA 3', className: 'hpa3', order: 3 },
}

export function CompanyTodosView() {
  const { userId, isLoaded } = useAuth()
  const { session } = useSession()
  const [tasks, setTasks] = useState<CompanyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<CompanyTaskPriority>('hpa1')
  const [blocked, setBlocked] = useState(false)
  const [blockedByIds, setBlockedByIds] = useState<string[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (!session || !userId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listCompanyTasks(session, userId)
      setTasks(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [session, userId])

  useEffect(() => {
    if (!isLoaded) return
    if (!userId || !session) {
      setLoading(false)
      return
    }
    void refresh()
  }, [isLoaded, userId, session, refresh])

  const titleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tasks) map.set(t.id, t.title)
    return map
  }, [tasks])

  const blockingCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) {
      for (const blocker of t.blockedByIds) {
        counts.set(blocker, (counts.get(blocker) || 0) + 1)
      }
    }
    return counts
  }, [tasks])

  const openTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        const pa = PRIORITY_META[a.priority].order
        const pb = PRIORITY_META[b.priority].order
        if (pa !== pb) return pa - pb
        return a.createdAt.localeCompare(b.createdAt)
      })
  }, [tasks])

  const doneTasks = useMemo(
    () => tasks.filter((t) => t.status === 'done').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tasks],
  )

  const openForBlockers = useMemo(
    () => tasks.filter((t) => t.status !== 'done'),
    [tasks],
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !userId || !title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await createCompanyTask(session, {
        userId,
        title,
        priority,
        blockedByIds: blocked ? blockedByIds : [],
      })
      setTitle('')
      setBlocked(false)
      setBlockedByIds([])
      setPriority('hpa1')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(task: CompanyTask, status: CompanyTaskStatus) {
    if (!session) return
    try {
      await updateCompanyTask(session, task.id, { status })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function setTaskPriority(task: CompanyTask, next: CompanyTaskPriority) {
    if (!session) return
    try {
      await updateCompanyTask(session, task.id, { priority: next })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority')
    }
  }

  async function setTaskBlockedBy(task: CompanyTask, ids: string[]) {
    if (!session) return
    try {
      await updateCompanyTask(session, task.id, { blockedByIds: ids })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update blockers')
    }
  }

  async function removeTask(task: CompanyTask) {
    if (!session) return
    if (!window.confirm(`Delete “${task.title}”?`)) return
    try {
      await deleteCompanyTask(session, task.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }

  function toggleBlockedByDraft(id: string) {
    setBlockedByIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function renderTask(task: CompanyTask) {
    const meta = PRIORITY_META[task.priority]
    const blockedNames = task.blockedByIds
      .map((id) => titleById.get(id))
      .filter(Boolean) as string[]
    const isBlocked = blockedNames.length > 0
    const blocks = blockingCount.get(task.id) || 0
    const created = new Date(task.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })

    return (
      <li key={task.id} className={`company-todo${isBlocked ? ' blocked' : ''}`}>
        <div className="company-todo-main">
          <label className="company-todo-check">
            <input
              type="checkbox"
              checked={task.status === 'done'}
              onChange={(e) => void setStatus(task, e.target.checked ? 'done' : 'not_started')}
            />
            <span className={task.status === 'done' ? 'done' : ''}>{task.title}</span>
          </label>
          <div className="company-todo-meta">
            <span className={`hpa-pill ${meta.className}`}>{meta.label}</span>
            <span className="company-todo-date" title="Created">
              {created}
            </span>
            <select
              className="company-todo-select"
              value={task.priority}
              onChange={(e) => void setTaskPriority(task, e.target.value as CompanyTaskPriority)}
              aria-label="Priority"
            >
              <option value="hpa1">HPA 1</option>
              <option value="hpa2">HPA 2</option>
              <option value="hpa3">HPA 3</option>
            </select>
            <select
              className="company-todo-select"
              value={task.status}
              onChange={(e) => void setStatus(task, e.target.value as CompanyTaskStatus)}
              aria-label="Status"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
            <button type="button" className="ghost-btn" onClick={() => void removeTask(task)}>
              Remove
            </button>
          </div>
        </div>
        {isBlocked && (
          <p className="company-todo-blocked">
            <span aria-hidden>⊘</span> Blocked by: {blockedNames.join(', ')}
          </p>
        )}
        {blocks > 0 && (
          <p className="company-todo-blocking">
            Blocking {blocks} task{blocks === 1 ? '' : 's'}
          </p>
        )}
        {task.status !== 'done' && (
          <details className="company-todo-deps">
            <summary>Dependencies</summary>
            <div className="company-todo-dep-list">
              {openForBlockers
                .filter((t) => t.id !== task.id)
                .map((t) => (
                  <label key={t.id} className="company-todo-dep-item">
                    <input
                      type="checkbox"
                      checked={task.blockedByIds.includes(t.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...task.blockedByIds, t.id]
                          : task.blockedByIds.filter((id) => id !== t.id)
                        void setTaskBlockedBy(task, next)
                      }}
                    />
                    <span>{t.title}</span>
                  </label>
                ))}
              {openForBlockers.filter((t) => t.id !== task.id).length === 0 && (
                <p className="finance-empty">No other open tasks to select.</p>
              )}
            </div>
          </details>
        )}
      </li>
    )
  }

  return (
    <div className="layout-stack company-todos">
      <HudPanel label="Company to-dos">
        <p className="finance-hint">
          Prioritize by HPA tier. Mark blockers so high-leverage work stays unblocked.
        </p>

        <form className="company-todo-form" onSubmit={(e) => void handleCreate(e)}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a company task…"
            aria-label="New task title"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as CompanyTaskPriority)}
            aria-label="Priority"
          >
            <option value="hpa1">HPA 1</option>
            <option value="hpa2">HPA 2</option>
            <option value="hpa3">HPA 3</option>
          </select>
          <label className="company-todo-blocked-toggle">
            <input
              type="checkbox"
              checked={blocked}
              onChange={(e) => {
                setBlocked(e.target.checked)
                if (!e.target.checked) setBlockedByIds([])
              }}
            />
            Blocked
          </label>
          <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
            Add
          </button>
        </form>

        {blocked && (
          <div className="company-todo-dep-picker">
            <span className="company-todo-picker-label">Blocked by</span>
            <div className="company-todo-dep-list">
              {openForBlockers.map((t) => (
                <label key={t.id} className="company-todo-dep-item">
                  <input
                    type="checkbox"
                    checked={blockedByIds.includes(t.id)}
                    onChange={() => toggleBlockedByDraft(t.id)}
                  />
                  <span>{t.title}</span>
                </label>
              ))}
              {openForBlockers.length === 0 && (
                <p className="finance-empty">Add another task first to set blockers.</p>
              )}
            </div>
          </div>
        )}

        {error && <p className="revolut-feedback bad">{error}</p>}
        {loading && <p className="finance-empty">Loading tasks…</p>}
        {!loading && openTasks.length === 0 && (
          <p className="finance-empty">No open company tasks yet.</p>
        )}

        {!loading && openTasks.length > 0 && (
          <ul className="company-todo-list">
            {(['hpa1', 'hpa2', 'hpa3'] as CompanyTaskPriority[]).map((tier) => {
              const group = openTasks.filter((t) => t.priority === tier)
              if (!group.length) return null
              return (
                <li key={tier} className="company-todo-group">
                  <div className="company-todo-group-head">
                    <span className={`hpa-pill ${PRIORITY_META[tier].className}`}>
                      {PRIORITY_META[tier].label}
                    </span>
                    <span className="company-todo-group-count">{group.length}</span>
                  </div>
                  <ul>{group.map(renderTask)}</ul>
                </li>
              )
            })}
          </ul>
        )}
      </HudPanel>

      {doneTasks.length > 0 && (
        <HudPanel
          label={`Completed (${doneTasks.length})`}
          action={
            <button type="button" className="ghost-btn" onClick={() => setShowCompleted((v) => !v)}>
              {showCompleted ? 'Collapse' : 'Expand'}
            </button>
          }
        >
          {showCompleted ? (
            <ul className="company-todo-list">{doneTasks.map(renderTask)}</ul>
          ) : (
            <p className="finance-empty">Collapsed — expand to review completed work.</p>
          )}
        </HudPanel>
      )}
    </div>
  )
}
