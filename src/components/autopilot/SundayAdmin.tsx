'use client'

import { useEffect, useMemo, useState } from 'react'
import { PROJECT_MAP } from '../../data/seed'
import type { Store } from '../../hooks/useStore'
import type { Task } from '../../types'
import {
  formatLongDate,
  formatMinutes,
  formatTimer,
  upcomingSunday,
} from '../../utils/time'
import { ModalPortal } from '../ui/ModalPortal'

const STEPS = [
  {
    id: 'reply',
    title: 'Reply to all',
    kicker: 'Step 1',
    copy: 'Clear every open message first. Reply to all, tick it off, then move into the pile.',
  },
  {
    id: 'tasks',
    title: 'One at a time',
    kicker: 'Step 2',
    copy: 'Pick a task. Full focus. Personal Time timer runs under you.',
  },
] as const

type Phase = (typeof STEPS)[number]['id']

export function SundayAdmin({
  store,
  open,
  onClose,
  onStartPersonalTimer,
}: {
  store: Store
  open: boolean
  onClose: () => void
  /** Start personal-time timer minimized under this focus UI */
  onStartPersonalTimer: (focusNote: string) => void
}) {
  const sunday = upcomingSunday()
  const [phase, setPhase] = useState<Phase>('reply')
  const [replyDone, setReplyDone] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [draftNotes, setDraftNotes] = useState('')

  const stepIndex = STEPS.findIndex((s) => s.id === phase)
  const step = STEPS[stepIndex] ?? STEPS[0]

  const tasks = useMemo(
    () =>
      (store.state.tasks.sundayAdmin ?? []).filter(
        (t) => !t.done && !t.archived && t.plannedDate === sunday,
      ),
    [store.state.tasks.sundayAdmin, sunday],
  )

  const focusTask: Task | null = focusId
    ? (tasks.find((t) => t.id === focusId) ?? null)
    : null

  useEffect(() => {
    if (!open) {
      setPhase('reply')
      setReplyDone(false)
      setFocusId(null)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (focusId) setFocusId(null)
        else if (phase === 'tasks') setPhase('reply')
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, focusId, phase])

  useEffect(() => {
    if (focusTask) setDraftNotes(focusTask.notes ?? '')
  }, [focusTask])

  if (!open || typeof document === 'undefined') return null

  const personal = PROJECT_MAP.personal
  const timerLive = store.state.activeTimer?.projectId === 'personal'
  const personalMinutes = store.projectMinutesToday.personal

  const enterFocus = (task: Task) => {
    setFocusId(task.id)
    setDraftNotes(task.notes ?? '')
    const live = store.state.activeTimer
    if (!live || live.projectId === 'personal') {
      onStartPersonalTimer(task.text)
    }
  }

  const saveNotes = () => {
    if (!focusTask) return
    if (draftNotes === (focusTask.notes ?? '')) return
    store.setTaskNotes('sundayAdmin', focusTask.id, draftNotes)
  }

  const completeFocus = () => {
    if (!focusTask) return
    saveNotes()
    store.toggleTask('sundayAdmin', focusTask.id)
    setFocusId(null)
  }

  return (
    <ModalPortal>
      <div
        className={`wind-down-overlay sunday-admin-overlay${focusTask ? ' focusing' : ''}`}
        role="dialog"
        aria-modal
        aria-labelledby="sunday-admin-title"
      >
        {!focusTask ? (
          <div className="wind-down-shell">
            <header className="wind-down-head">
              <div className="wind-down-brand">
                <span className="wind-down-kicker">Autopilot · Sunday Admin</span>
                <h2 id="sunday-admin-title">{step.title}</h2>
                <p className="wind-down-copy">
                  {phase === 'tasks'
                    ? `${formatLongDate(sunday)}. ${step.copy}`
                    : step.copy}
                </p>
              </div>
              <button type="button" className="x-btn visible" onClick={onClose} aria-label="Close">
                ×
              </button>
            </header>

            <ol className="wind-down-steps" aria-label="Sunday Admin progress">
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

            <div className="wind-down-body">
              {phase === 'reply' ? (
                <div className="wind-down-panel wind-down-journal">
                  <div className="wind-down-journal-card">
                    <p className="wind-down-journal-prompt">
                      Open your inbox. Reply to every message that needs a response — no
                      half-clears. Empty the loop before the admin pile.
                    </p>
                    <p className="wind-down-journal-hint">
                      Email, WhatsApp, Slack — wherever the replies live. Tick only when
                      every one is sent.
                    </p>
                    <label className="wind-down-check">
                      <input
                        type="checkbox"
                        checked={replyDone}
                        onChange={(e) => setReplyDone(e.target.checked)}
                      />
                      <span>Reply to all messages</span>
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sunday-pulse">
                    <span className="status-pill" style={{ borderColor: `${personal.color}66` }}>
                      PERSONAL TIME
                    </span>
                    <span>
                      {timerLive ? 'Timer live' : 'Timer starts when you pick a task'} · today{' '}
                      {formatMinutes(personalMinutes)}
                    </span>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="wind-down-done">
                      <div className="wind-down-done-mark" aria-hidden="true" />
                      <p>No tasks allocated for this Sunday.</p>
                      <p className="sunday-rec-note">
                        Run Saturday Dump to load the pile, then come back.
                      </p>
                      <button type="button" className="btn-primary" onClick={onClose}>
                        Close
                      </button>
                    </div>
                  ) : (
                    <ul className="sunday-admin-list">
                      {tasks.map((t, i) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            className="sunday-admin-pick"
                            onClick={() => enterFocus(t)}
                          >
                            <span className="sunday-admin-pick-index">{i + 1}</span>
                            <span className="sunday-admin-pick-body">
                              <span className="sunday-admin-pick-title">{t.text}</span>
                              {t.notes?.trim() ? (
                                <span className="sunday-admin-pick-notes">{t.notes}</span>
                              ) : null}
                            </span>
                            <span className="sunday-admin-pick-cta">Focus</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {phase === 'reply' ? (
              <footer className="wind-down-foot">
                <button type="button" className="ghost-btn" onClick={onClose}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setPhase('tasks')}
                  disabled={!replyDone}
                >
                  Complete · next
                </button>
              </footer>
            ) : tasks.length > 0 ? (
              <footer className="wind-down-foot">
                <button type="button" className="ghost-btn" onClick={() => setPhase('reply')}>
                  Back
                </button>
                <span className="sunday-finance-lede">
                  {tasks.length} remaining · complete one, return, pick the next
                </span>
                <button type="button" className="ghost-btn" onClick={onClose}>
                  Done for now
                </button>
              </footer>
            ) : (
              <footer className="wind-down-foot">
                <button type="button" className="ghost-btn" onClick={() => setPhase('reply')}>
                  Back
                </button>
              </footer>
            )}
          </div>
        ) : (
          <div className="sunday-admin-focus">
            <header className="sunday-admin-focus-head">
              <span className="wind-down-kicker">Sunday Admin · Focus</span>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  saveNotes()
                  setFocusId(null)
                }}
              >
                Back to list
              </button>
            </header>

            <div className="sunday-admin-focus-stage">
              <p className="sunday-admin-focus-label">This task only</p>
              <h2 className="sunday-admin-focus-title">{focusTask.text}</h2>

              <div className="sunday-admin-focus-timer">
                <span className="dot" style={{ background: personal.color }} />
                <span>Personal Time</span>
                {store.state.activeTimer?.projectId === 'personal' ? (
                  <strong className="sunday-admin-focus-digits">
                    {formatTimer(store.liveTimerSeconds)}
                    {store.isTimerPaused ? ' · paused' : ''}
                  </strong>
                ) : store.state.activeTimer ? (
                  <strong>Another timer is live — finish it to start Personal Time</strong>
                ) : (
                  <strong>Timer starting…</strong>
                )}
              </div>

              <label className="field sunday-field">
                <span className="field-label">Notes</span>
                <textarea
                  rows={5}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Working notes for this task"
                />
              </label>

              <div className="sunday-admin-focus-actions">
                <button type="button" className="btn-primary" onClick={completeFocus}>
                  Complete · next
                </button>
                {store.state.activeTimer?.projectId === 'personal' && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      store.isTimerPaused ? store.resumeTimer() : store.pauseTimer()
                    }
                  >
                    {store.isTimerPaused ? 'Resume timer' : 'Pause timer'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalPortal>
  )
}
