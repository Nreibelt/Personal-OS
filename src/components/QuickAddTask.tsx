'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { PROJECTS } from '../data/seed'
import type { Store } from '../hooks/useStore'
import type { ProjectId } from '../types'
import { Modal } from './ui/Modal'

export function QuickAddTask({ store }: { store: Store }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState<ProjectId>('chase')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setText('')
    setProjectId('chase')
    setDate('')
    setNotes('')
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    store.addTask(projectId, trimmed, {
      plannedDate: date || null,
      notes,
    })
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="quick-task-toggle"
        onClick={() => setOpen(true)}
        aria-label="Quick add task"
      >
        + Task
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Quick add task"
        size="sm"
        footer={
          <>
            <button type="button" className="ghost-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="quick-add-task-form" className="btn-primary">
              Add task
            </button>
          </>
        }
      >
        <form id="quick-add-task-form" className="quick-add-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Task</span>
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What needs doing?"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Category</span>
            <select
              className="field-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value as ProjectId)}
            >
              {PROJECTS.filter((p) => p.id !== 'personal').map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">
              Date <span className="field-optional">optional</span>
            </span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">
              Notes <span className="field-optional">optional</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context, links, next action…"
              rows={3}
            />
          </label>
        </form>
      </Modal>
    </>
  )
}
