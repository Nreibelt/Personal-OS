'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Store } from '../../hooks/useStore'
import { formatLongDate, upcomingSunday } from '../../utils/time'
import { ModalPortal } from '../ui/ModalPortal'

const STEPS = [
  {
    id: 'dump',
    title: 'Brain dump → Sunday Admin',
    kicker: 'Step 1',
    copy: 'Paste from your notebook. One line per task. Empty the page into the system.',
  },
  {
    id: 'allocate',
    title: 'Allocate tomorrow’s Sunday',
    kicker: 'Step 2',
    copy: 'Pick what gets focus tomorrow. Notes welcome. Skip twice in a row and it’s gone.',
  },
] as const

export function SaturdayDump({
  store,
  open,
  onClose,
}: {
  store: Store
  open: boolean
  onClose: () => void
}) {
  const sunday = upcomingSunday()
  const [stepIndex, setStepIndex] = useState(0)
  const [paste, setPaste] = useState('')
  const [allocated, setAllocated] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [finished, setFinished] = useState(false)
  const [purgedCount, setPurgedCount] = useState(0)
  const [lockedCount, setLockedCount] = useState(0)

  const step = STEPS[stepIndex]
  const adminTasks = useMemo(
    () => (store.state.tasks.sundayAdmin ?? []).filter((t) => !t.done && !t.archived),
    [store.state.tasks.sundayAdmin],
  )

  const wasOpen = useRef(false)
  useEffect(() => {
    if (!open) {
      wasOpen.current = false
      return
    }
    if (wasOpen.current) return
    wasOpen.current = true
    setStepIndex(0)
    setPaste('')
    setFinished(false)
    setPurgedCount(0)
    setLockedCount(0)
    const nextAlloc: Record<string, boolean> = {}
    const nextNotes: Record<string, string> = {}
    for (const t of store.state.tasks.sundayAdmin ?? []) {
      if (t.done || t.archived) continue
      nextAlloc[t.id] = t.plannedDate === sunday
      nextNotes[t.id] = t.notes ?? ''
    }
    setAllocated(nextAlloc)
    setNotes(nextNotes)
  }, [open, sunday, store.state.tasks.sundayAdmin])

  // Keep local maps in sync when new tasks appear (after import)
  useEffect(() => {
    if (!open) return
    setAllocated((prev) => {
      const next = { ...prev }
      for (const t of adminTasks) {
        if (next[t.id] === undefined) next[t.id] = t.plannedDate === sunday
      }
      return next
    })
    setNotes((prev) => {
      const next = { ...prev }
      for (const t of adminTasks) {
        if (next[t.id] === undefined) next[t.id] = t.notes ?? ''
      }
      return next
    })
  }, [adminTasks, open, sunday])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const importPaste = () => {
    const lines = paste
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    for (const line of lines) {
      store.addTask('sundayAdmin', line, { plannedDate: null, forToday: false })
    }
    setPaste('')
    return lines.length
  }

  const goAllocate = () => {
    if (paste.trim()) importPaste()
    setStepIndex(1)
  }

  const finalize = () => {
    const ids = adminTasks.filter((t) => allocated[t.id]).map((t) => t.id)
    const atRisk = adminTasks.filter(
      (t) => !allocated[t.id] && (t.sundayDeferCount ?? 0) >= 1,
    ).length
    const noteMap: Record<string, string> = {}
    for (const t of adminTasks) {
      noteMap[t.id] = notes[t.id] ?? t.notes ?? ''
    }
    store.finalizeSaturdayDump(sunday, ids, noteMap)
    setLockedCount(ids.length)
    setPurgedCount(atRisk)
    setFinished(true)
  }

  return (
    <ModalPortal>
      <div className="wind-down-overlay" role="dialog" aria-modal aria-labelledby="saturday-dump-title">
        <div className="wind-down-shell">
          <header className="wind-down-head">
            <div className="wind-down-brand">
              <span className="wind-down-kicker">Autopilot · Saturday Dump</span>
              <h2 id="saturday-dump-title">
                {finished ? 'Sunday is loaded' : step.title}
              </h2>
              <p className="wind-down-copy">
                {finished
                  ? `Prep locked for ${formatLongDate(sunday)}. Run Sunday Admin tomorrow — one task at a time.`
                  : step.copy}
              </p>
            </div>
            <button type="button" className="x-btn visible" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          {!finished && (
            <ol className="wind-down-steps" aria-label="Saturday Dump progress">
              {STEPS.map((s, i) => (
                <li
                  key={s.id}
                  className={`wind-down-step${i === stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}
                >
                  <span className="wind-down-step-index">{i + 1}</span>
                  <span className="wind-down-step-label">{s.kicker}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="wind-down-body">
            {finished ? (
              <div className="wind-down-done">
                <div className="wind-down-done-mark" aria-hidden="true" />
                <p>
                  {lockedCount} task{lockedCount === 1 ? '' : 's'} allocated to{' '}
                  {formatLongDate(sunday)}.
                </p>
                {purgedCount > 0 && (
                  <p className="sunday-rec-note">
                    {purgedCount} task{purgedCount === 1 ? '' : 's'} purged — deferred two Saturdays
                    in a row. Feedback loop held.
                  </p>
                )}
                <button type="button" className="btn-primary" onClick={onClose}>
                  Close
                </button>
              </div>
            ) : step.id === 'dump' ? (
              <div className="sunday-panel">
                <label className="field sunday-field">
                  <span className="field-label">Notebook paste</span>
                  <textarea
                    rows={10}
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder={'One task per line\nPay insurance\nSort visa docs\n…'}
                  />
                </label>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={importPaste}
                    disabled={!paste.trim()}
                  >
                    Import into Sunday Admin
                  </button>
                </div>
                <p className="sunday-finance-lede">
                  {adminTasks.length} open Sunday Admin task{adminTasks.length === 1 ? '' : 's'} in
                  the pile.
                </p>
              </div>
            ) : (
              <div className="sunday-panel">
                <div className="sunday-pulse">
                  <span className="status-pill">SUNDAY · {formatLongDate(sunday)}</span>
                  <span>Toggle allocate. Two skips = delete.</span>
                </div>
                {adminTasks.length === 0 ? (
                  <p className="empty-tasks">No Sunday Admin tasks — dump first or you’re clear.</p>
                ) : (
                  <ul className="saturday-alloc-list">
                    {adminTasks.map((t) => {
                      const defer = t.sundayDeferCount ?? 0
                      const on = Boolean(allocated[t.id])
                      return (
                        <li
                          key={t.id}
                          className={`saturday-alloc-row${on ? ' on' : ''}${defer >= 1 && !on ? ' at-risk' : ''}`}
                        >
                          <label className="saturday-alloc-check">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(e) =>
                                setAllocated((m) => ({ ...m, [t.id]: e.target.checked }))
                              }
                            />
                            <span className="saturday-alloc-text">{t.text}</span>
                          </label>
                          {defer >= 1 && !on && (
                            <span className="saturday-risk">Final chance — skip deletes</span>
                          )}
                          <label className="field saturday-alloc-notes">
                            <span className="field-label">Notes</span>
                            <textarea
                              rows={2}
                              value={notes[t.id] ?? ''}
                              onChange={(e) =>
                                setNotes((m) => ({ ...m, [t.id]: e.target.value }))
                              }
                              placeholder="Context for Sunday-you"
                            />
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {!finished && (
            <footer className="wind-down-foot">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                disabled={stepIndex === 0}
              >
                Back
              </button>
              {step.id === 'dump' ? (
                <button type="button" className="btn-primary" onClick={goAllocate}>
                  Complete · allocate
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={finalize}>
                  Lock Sunday prep
                </button>
              )}
            </footer>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
