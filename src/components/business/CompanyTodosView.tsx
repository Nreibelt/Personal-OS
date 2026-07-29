'use client'

import { useAuth, useSession } from '@clerk/nextjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { HudPanel } from '../HudPanel'
import { Checkbox } from '../ui/Checkbox'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Select } from '../ui/Select'
import {
  createCompanyTask,
  deleteCompanyTask,
  listCompanyTasks,
  updateCompanyTask,
} from '../../lib/supabase/companyTodos'
import type { CompanyTask, CompanyTaskStatus, EisenhowerQuadrant } from '../../types'
import { EISENHOWER_META, EISENHOWER_OPTIONS, EISENHOWER_ORDER } from '../../utils/eisenhower'

type FocusFilter = 'focus' | 'all' | 'waiting' | 'done'

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

export function CompanyTodosView() {
  const { userId, isLoaded } = useAuth()
  const { session } = useSession()
  const [tasks, setTasks] = useState<CompanyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<EisenhowerQuadrant>('do')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<FocusFilter>('focus')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CompanyTask | null>(null)
  const [subDraft, setSubDraft] = useState<Record<string, string>>({})
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})

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

  const roots = useMemo(() => tasks.filter((t) => !t.parentId), [tasks])
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, CompanyTask[]>()
    for (const t of tasks) {
      if (!t.parentId) continue
      const list = map.get(t.parentId) || []
      list.push(t)
      map.set(t.parentId, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
    return map
  }, [tasks])

  const titleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of roots) map.set(t.id, t.title)
    return map
  }, [roots])

  const isBlocked = useCallback(
    (task: CompanyTask) => {
      const openBlockers = task.blockedByIds.filter((id) => {
        const blocker = roots.find((t) => t.id === id)
        return blocker && blocker.status !== 'done'
      })
      return openBlockers.length > 0
    },
    [roots],
  )

  const openRoots = useMemo(
    () =>
      roots
        .filter((t) => t.status !== 'done')
        .sort((a, b) => {
          const pa = EISENHOWER_META[a.priority].order
          const pb = EISENHOWER_META[b.priority].order
          if (pa !== pb) return pa - pb
          const ba = isBlocked(a) ? 1 : 0
          const bb = isBlocked(b) ? 1 : 0
          if (ba !== bb) return ba - bb
          return a.createdAt.localeCompare(b.createdAt)
        }),
    [roots, isBlocked],
  )

  const focusTasks = useMemo(() => {
    return openRoots.filter((t) => {
      if (isBlocked(t)) return false
      return t.priority === 'do' || t.priority === 'schedule'
    })
  }, [openRoots, isBlocked])

  const waitingTasks = useMemo(() => openRoots.filter((t) => isBlocked(t)), [openRoots, isBlocked])

  const doneRoots = useMemo(
    () => roots.filter((t) => t.status === 'done').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [roots],
  )

  const visible = useMemo(() => {
    if (filter === 'focus') return focusTasks
    if (filter === 'waiting') return waitingTasks
    if (filter === 'done') return doneRoots
    return openRoots
  }, [filter, focusTasks, waitingTasks, doneRoots, openRoots])

  const groupedAll = useMemo(() => {
    if (filter !== 'all') return null
    return EISENHOWER_ORDER.map((q) => ({
      quadrant: q,
      tasks: openRoots.filter((t) => t.priority === q && !isBlocked(t)),
    })).filter((g) => g.tasks.length > 0)
  }, [filter, openRoots, isBlocked])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !userId || !title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await createCompanyTask(session, { userId, title, priority })
      setTitle('')
      setPriority('do')
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

  async function setTaskPriority(task: CompanyTask, next: EisenhowerQuadrant) {
    if (!session) return
    try {
      await updateCompanyTask(session, task.id, { priority: next })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority')
    }
  }

  async function saveNotes(task: CompanyTask) {
    if (!session) return
    const notes = noteDraft[task.id] ?? task.notes
    try {
      await updateCompanyTask(session, task.id, { notes })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes')
    }
  }

  async function addSubtask(parent: CompanyTask) {
    if (!session || !userId) return
    const text = (subDraft[parent.id] || '').trim()
    if (!text) return
    try {
      await createCompanyTask(session, {
        userId,
        title: text,
        priority: parent.priority,
        parentId: parent.id,
      })
      setSubDraft((prev) => ({ ...prev, [parent.id]: '' }))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sub-task')
    }
  }

  async function confirmDelete() {
    if (!session || !pendingDelete) return
    const task = pendingDelete
    setPendingDelete(null)
    try {
      await deleteCompanyTask(session, task.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }

  function toggleExpand(task: CompanyTask) {
    setExpandedId((id) => {
      const next = id === task.id ? null : task.id
      if (next) {
        setNoteDraft((prev) => ({ ...prev, [task.id]: prev[task.id] ?? task.notes }))
      }
      return next
    })
  }

  function renderTask(task: CompanyTask) {
    const meta = EISENHOWER_META[task.priority]
    const blocked = isBlocked(task)
    const blockedNames = task.blockedByIds
      .map((id) => titleById.get(id))
      .filter(Boolean) as string[]
    const subs = subtasksByParent.get(task.id) || []
    const doneSubs = subs.filter((s) => s.status === 'done').length
    const expanded = expandedId === task.id
    const created = new Date(task.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })

    return (
      <li key={task.id} className={`company-todo${blocked ? ' blocked' : ''}${expanded ? ' expanded' : ''}`}>
        <div className="company-todo-main">
          <Checkbox
            checked={task.status === 'done'}
            onChange={(on) => void setStatus(task, on ? 'done' : 'not_started')}
            aria-label={`Mark ${task.title} done`}
          />
          <button type="button" className="company-todo-title-btn" onClick={() => toggleExpand(task)}>
            <span className={task.status === 'done' ? 'done' : ''}>{task.title}</span>
            {subs.length > 0 && (
              <span className="company-todo-subcount">
                {doneSubs}/{subs.length}
              </span>
            )}
          </button>
          <div className="company-todo-meta">
            <span className={`hpa-pill ${meta.className}`} title={meta.hint}>
              {meta.label}
            </span>
            <span className="company-todo-date">{created}</span>
            <Select
              className="company-todo-select"
              value={task.priority}
              ariaLabel="Eisenhower quadrant"
              options={EISENHOWER_OPTIONS}
              onChange={(v) => void setTaskPriority(task, v as EisenhowerQuadrant)}
            />
            <Select
              className="company-todo-select"
              value={task.status}
              ariaLabel="Status"
              options={STATUS_OPTIONS}
              onChange={(v) => void setStatus(task, v as CompanyTaskStatus)}
            />
            <button type="button" className="ghost-btn" onClick={() => setPendingDelete(task)}>
              Remove
            </button>
          </div>
        </div>

        {blocked && (
          <p className="company-todo-blocked">
            Waiting on: {blockedNames.join(', ')}
          </p>
        )}

        {expanded && (
          <div className="company-todo-detail">
            <label className="field-label">Notes</label>
            <textarea
              className="company-todo-notes"
              rows={3}
              placeholder="Context, links, decisions…"
              value={noteDraft[task.id] ?? task.notes}
              onChange={(e) => setNoteDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
              onBlur={() => void saveNotes(task)}
            />

            <div className="company-todo-subs">
              <div className="company-todo-subs-head">
                <span className="field-label">Sub-tasks</span>
                {subs.length > 0 && (
                  <span className="company-todo-group-count">
                    {doneSubs}/{subs.length}
                  </span>
                )}
              </div>
              <ul className="company-todo-sublist">
                {subs.map((sub) => (
                  <li key={sub.id} className="company-todo-subitem">
                    <Checkbox
                      checked={sub.status === 'done'}
                      onChange={(on) => void setStatus(sub, on ? 'done' : 'not_started')}
                      label={sub.title}
                    />
                    <button
                      type="button"
                      className="x-btn visible"
                      aria-label={`Remove ${sub.title}`}
                      onClick={() => setPendingDelete(sub)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="company-todo-subform"
                onSubmit={(e) => {
                  e.preventDefault()
                  void addSubtask(task)
                }}
              >
                <input
                  value={subDraft[task.id] || ''}
                  onChange={(e) => setSubDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  placeholder="Add a sub-task…"
                  aria-label="New sub-task"
                />
                <button type="submit" className="btn-secondary compact" disabled={!(subDraft[task.id] || '').trim()}>
                  Add
                </button>
              </form>
            </div>
          </div>
        )}
      </li>
    )
  }

  const focusHint =
    filter === 'focus'
      ? 'Showing Do First + Schedule only — unblocked work that actually moves the company.'
      : filter === 'waiting'
        ? 'Blocked tasks. Clear the dependency, then they resurface in Focus.'
        : filter === 'done'
          ? 'Completed work archive.'
          : 'Full matrix view by quadrant.'

  return (
    <div className="layout-stack company-todos">
      <HudPanel label="Company to-dos">
        <p className="finance-hint">{focusHint}</p>

        <div className="focus-filter-bar" role="tablist" aria-label="Task focus">
          {(
            [
              ['focus', `Focus (${focusTasks.length})`],
              ['all', `Matrix (${openRoots.length})`],
              ['waiting', `Waiting (${waitingTasks.length})`],
              ['done', `Done (${doneRoots.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`focus-filter-btn${filter === id ? ' active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="company-todo-form" onSubmit={(e) => void handleCreate(e)}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a company task…"
            aria-label="New task title"
          />
          <Select
            value={priority}
            onChange={(v) => setPriority(v as EisenhowerQuadrant)}
            options={EISENHOWER_OPTIONS}
            ariaLabel="Eisenhower quadrant"
          />
          <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
            Add
          </button>
        </form>

        {error && <p className="revolut-feedback bad">{error}</p>}
        {loading && <p className="finance-empty">Loading tasks…</p>}
        {!loading && visible.length === 0 && !groupedAll?.length && (
          <p className="finance-empty">
            {filter === 'focus'
              ? 'Nothing in focus. Add a Do First or Schedule task — or clear a blocker.'
              : 'No tasks here.'}
          </p>
        )}

        {!loading && filter === 'all' && groupedAll && (
          <ul className="company-todo-list">
            {groupedAll.map((group) => (
              <li key={group.quadrant} className="company-todo-group">
                <div className="company-todo-group-head">
                  <span className={`hpa-pill ${EISENHOWER_META[group.quadrant].className}`}>
                    {EISENHOWER_META[group.quadrant].label}
                  </span>
                  <span className="company-todo-group-hint">
                    {EISENHOWER_META[group.quadrant].hint}
                  </span>
                  <span className="company-todo-group-count">{group.tasks.length}</span>
                </div>
                <ul>{group.tasks.map(renderTask)}</ul>
              </li>
            ))}
            {waitingTasks.length > 0 && (
              <li className="company-todo-group">
                <div className="company-todo-group-head">
                  <span className="hpa-pill eq-waiting">Waiting</span>
                  <span className="company-todo-group-hint">Blocked by dependencies</span>
                  <span className="company-todo-group-count">{waitingTasks.length}</span>
                </div>
                <ul>{waitingTasks.map(renderTask)}</ul>
              </li>
            )}
          </ul>
        )}

        {!loading && filter !== 'all' && visible.length > 0 && (
          <ul className="company-todo-list">
            <li className="company-todo-group">
              <ul>{visible.map(renderTask)}</ul>
            </li>
          </ul>
        )}
      </HudPanel>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete task"
        message={
          pendingDelete
            ? `Delete “${pendingDelete.title}”?${pendingDelete.parentId ? '' : ' Sub-tasks will be removed too.'}`
            : ''
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
