'use client'

import { useEffect, useMemo, useState } from 'react'
import { PROJECTS } from '../../data/seed'
import type { Store } from '../../hooks/useStore'
import { addDays, formatLongDate, todayDateKey } from '../../utils/time'
import { CashTrackerPanel } from '../finance/CashTrackerPanel'
import { RevolutSyncPanel } from '../finance/RevolutSyncPanel'
import { ScheduleCalendar } from '../ScheduleCalendar'
import { TaskRow } from '../TaskRow'
import { ModalPortal } from '../ui/ModalPortal'

const STEPS = [
  {
    id: 'finance',
    title: 'Finance logger',
    kicker: 'Step 1',
    copy: 'Sync Revolut and log today’s cash. Clear the money loop before you shut down.',
  },
  {
    id: 'calendar',
    title: 'Tomorrow’s calendar',
    kicker: 'Step 2',
    copy: 'Map tomorrow once. Put the day on rails so morning-you doesn’t decide.',
  },
  {
    id: 'tasks',
    title: 'Assign tomorrow’s tasks',
    kicker: 'Step 3',
    copy: 'Walk the list. Park work on tomorrow’s date — or leave it in Later.',
  },
  {
    id: 'journal',
    title: 'Journal',
    kicker: 'Step 4',
    copy: 'One honest page. Empty the residual charge, then close the day.',
  },
] as const

export function EveningWindDown({
  store,
  open,
  onClose,
}: {
  store: Store
  open: boolean
  onClose: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [journalDone, setJournalDone] = useState(false)
  const [finished, setFinished] = useState(false)

  const today = todayDateKey()
  const tomorrow = addDays(today, 1)
  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

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

  useEffect(() => {
    if (open) return
    setStepIndex(0)
    setJournalDone(false)
    setFinished(false)
  }, [open])

  const openTasks = useMemo(() => {
    return PROJECTS.flatMap((project) =>
      (store.state.tasks[project.id] ?? [])
        .filter((t) => !t.done && !t.archived)
        .map((task) => ({ project, task })),
    )
  }, [store.state.tasks])

  const tomorrowCount = openTasks.filter((row) => row.task.plannedDate === tomorrow).length

  if (!open || typeof document === 'undefined') return null

  const advance = () => {
    if (isLast) {
      setFinished(true)
      return
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  const back = () => {
    if (finished) {
      setFinished(false)
      return
    }
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  return (
    <ModalPortal>
      <div className="wind-down-overlay" role="dialog" aria-modal aria-labelledby="wind-down-title">
        <div className="wind-down-shell">
          <header className="wind-down-head">
            <div className="wind-down-brand">
              <span className="wind-down-kicker">Autopilot · Evening Wind Down</span>
              <h2 id="wind-down-title">
                {finished ? 'Wind down complete' : step.title}
              </h2>
              <p className="wind-down-copy">
                {finished
                  ? 'Day closed. Tomorrow is already loaded. Sleep is the next move.'
                  : step.copy}
              </p>
            </div>
            <button type="button" className="x-btn visible" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          {!finished && (
            <ol className="wind-down-steps" aria-label="Wind down progress">
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
                <p>Evening Wind Down locked in for {formatLongDate(today)}.</p>
                <button type="button" className="btn-primary" onClick={onClose}>
                  Close
                </button>
              </div>
            ) : (
              <>
                {step.id === 'finance' && (
                  <div className="wind-down-panel wind-down-finance">
                    <RevolutSyncPanel store={store} realm="personal" embedded />
                    <CashTrackerPanel store={store} realm="personal" mode="daily" embedded />
                  </div>
                )}

                {step.id === 'calendar' && (
                  <div className="wind-down-panel">
                    <div className="wind-down-panel-meta">
                      <span className="status-pill">TOMORROW</span>
                      <span className="wind-down-panel-date">{formatLongDate(tomorrow)}</span>
                    </div>
                    <ScheduleCalendar
                      store={store}
                      centerDate={tomorrow}
                      lockSpan={1}
                      hideNav
                      bodyHeight={480}
                    />
                  </div>
                )}

                {step.id === 'tasks' && (
                  <div className="wind-down-panel wind-down-tasks">
                    <div className="wind-down-panel-meta">
                      <span className="status-pill">
                        {tomorrowCount} parked on tomorrow
                      </span>
                      <span className="wind-down-panel-date">{formatLongDate(tomorrow)}</span>
                    </div>
                    {openTasks.length === 0 ? (
                      <p className="empty-tasks">No open tasks — you’re clear.</p>
                    ) : (
                      <div className="wind-down-task-groups">
                        {PROJECTS.map((project) => {
                          const rows = openTasks.filter((r) => r.project.id === project.id)
                          if (rows.length === 0) return null
                          return (
                            <section key={project.id} className="wind-down-task-group">
                              <header className="wind-down-task-group-head">
                                <span className="dot" style={{ background: project.color }} />
                                <h3 style={{ color: project.color }}>{project.name}</h3>
                              </header>
                              <ul className="check-list">
                                {rows.map(({ task }) => (
                                  <TaskRow
                                    key={task.id}
                                    task={task}
                                    project={project}
                                    store={store}
                                    showScope={false}
                                    showDateAssign
                                  />
                                ))}
                              </ul>
                            </section>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step.id === 'journal' && (
                  <div className="wind-down-panel wind-down-journal">
                    <div className="wind-down-journal-card">
                      <p className="wind-down-journal-prompt">
                        Write for five minutes. No performance. Capture what happened, what
                        mattered, and what you want tomorrow-you to remember.
                      </p>
                      <p className="wind-down-journal-hint">
                        Notebook, notes app, or paper — wherever the friction is lowest. The
                        ritual is the writing, not the tool.
                      </p>
                      <label className="wind-down-check">
                        <input
                          type="checkbox"
                          checked={journalDone}
                          onChange={(e) => setJournalDone(e.target.checked)}
                        />
                        <span>Journal complete</span>
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!finished && (
            <footer className="wind-down-foot">
              <button
                type="button"
                className="ghost-btn"
                onClick={back}
                disabled={stepIndex === 0}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={advance}
                disabled={step.id === 'journal' && !journalDone}
              >
                {isLast ? 'Complete wind down' : 'Complete · next'}
              </button>
            </footer>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
