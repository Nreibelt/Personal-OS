'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PROJECTS, uid } from '../../data/seed'
import type { Store } from '../../hooks/useStore'
import type { ProjectId, WeekPattern, WeekReflection, WeeklyGoal } from '../../types'
import {
  allocatableBuckets,
  budgetForCategory,
  formatMoney,
  spentForCategory,
} from '../../utils/finance'
import {
  addDays,
  formatLongDate,
  formatMinutes,
  startOfWeekMonday,
  todayDateKey,
} from '../../utils/time'
import { ModalPortal } from '../ui/ModalPortal'

const STEPS = [
  {
    id: 'reflect',
    phase: 'Analysis',
    title: 'Week reflection',
    kicker: 'Part 1 · Reflect',
    copy: 'Look back without flinching. Pride, patterns, friction, remedies.',
  },
  {
    id: 'prior-goals',
    phase: 'Analysis',
    title: 'Prior week goals',
    kicker: 'Part 1 · Goals',
    copy: 'Did you hit what you set? Honest why — not a performance review.',
  },
  {
    id: 'finance',
    phase: 'Analysis',
    title: 'Finance re-analysis',
    kicker: 'Part 1 · Money',
    copy: 'Walk set spendings. Cut what you can. Check budget vs actual.',
  },
  {
    id: 'goals',
    phase: 'Planning',
    title: 'Three weekly goals',
    kicker: 'Part 2 · Goals',
    copy: 'Three inputs. Visible all week. Everything else is noise.',
  },
  {
    id: 'focus',
    phase: 'Planning',
    title: 'Key intention',
    kicker: 'Part 2 · Focus',
    copy: 'Settle the noise. What is the ACTUAL focus everything else orbits?',
  },
  {
    id: 'tasks',
    phase: 'Planning',
    title: 'Week brain dump',
    kicker: 'Part 2 · Tasks',
    copy: 'Load anything top of mind for the week ahead. Capture, don’t polish.',
  },
  {
    id: 'journal',
    phase: 'Close',
    title: 'Deep journal',
    kicker: 'Part 3 · Paper',
    copy: 'Deep reflection and identity writing — on paper. The OS stays out of the way.',
  },
] as const

function blankGoals(): WeeklyGoal[] {
  return [0, 1, 2].map(() => ({
    id: uid('wgoal'),
    text: '',
    hit: null,
    why: '',
  }))
}

function blankReflection(): WeekReflection {
  return {
    proud: '',
    patterns: [{ id: uid('pat'), pattern: '', evolution: '' }],
    improve: '',
    productivityShortfall: '',
    productivityRemedy: '',
  }
}

function goalsForReview(store: Store, priorWeekStart: string): WeeklyGoal[] {
  if (store.state.weeklyGoalsWeekStart === priorWeekStart) {
    return store.state.weeklyGoals.map((g) => ({ ...g }))
  }
  const archived = store.state.weeklyGoalsArchive.find((e) => e.weekStart === priorWeekStart)
  if (archived) return archived.goals.map((g) => ({ ...g }))
  // Fall back to current goals if they look like last week’s unset review
  if (store.state.weeklyGoals.some((g) => g.text.trim())) {
    return store.state.weeklyGoals.map((g) => ({ ...g }))
  }
  return blankGoals()
}

export function SundayCenter({
  store,
  open,
  onClose,
}: {
  store: Store
  open: boolean
  onClose: () => void
}) {
  const today = todayDateKey()
  const priorWeekStart = startOfWeekMonday(today)
  const nextWeekStart = addDays(priorWeekStart, 7)

  const [stepIndex, setStepIndex] = useState(0)
  const [journalDone, setJournalDone] = useState(false)
  const [finished, setFinished] = useState(false)

  const [reflection, setReflection] = useState<WeekReflection>(blankReflection)
  const [priorGoals, setPriorGoals] = useState<WeeklyGoal[]>(blankGoals)
  const [nextGoals, setNextGoals] = useState<WeeklyGoal[]>(blankGoals)
  const [focus, setFocus] = useState('')
  const [dumpText, setDumpText] = useState('')
  const [dumpProject, setDumpProject] = useState<ProjectId>('chase')
  const [dumpDate, setDumpDate] = useState(nextWeekStart)

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  const wasOpen = useRef(false)
  useEffect(() => {
    if (!open) {
      wasOpen.current = false
      return
    }
    if (wasOpen.current) return
    wasOpen.current = true
    const saved = store.state.weekReflections[priorWeekStart]
    setReflection(
      saved
        ? {
            ...saved,
            patterns: saved.patterns.length ? saved.patterns : blankReflection().patterns,
          }
        : blankReflection(),
    )
    setPriorGoals(goalsForReview(store, priorWeekStart))
    setNextGoals(
      store.state.weeklyGoalsWeekStart === nextWeekStart
        ? store.state.weeklyGoals.map((g) => ({ ...g }))
        : blankGoals(),
    )
    setFocus(store.state.weekIntention)
    setDumpText('')
    setDumpProject('chase')
    setDumpDate(nextWeekStart)
    setStepIndex(0)
    setJournalDone(false)
    setFinished(false)
  }, [open, priorWeekStart, nextWeekStart, store])

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

  const weekPulse = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(priorWeekStart, i)).filter((d) => d <= today)
    const target = store.state.dailyDeepWorkTargetMinutes
    let hours = 0
    let hits = 0
    for (const d of days) {
      const mins = store.deepWorkMinutesForDate(d)
      hours += mins
      if (mins >= target) hits += 1
    }
    return { days: days.length, hits, hours, target }
  }, [priorWeekStart, today, store])

  const financeRows = useMemo(() => {
    const ledger = store.financeFor('personal')
    const buckets = allocatableBuckets(ledger)
    return buckets.map((cat) => {
      const budget = budgetForCategory(ledger, cat.id)
      const spent = spentForCategory(ledger, cat.id, today)
      const over = spent > budget && budget > 0
      const under = spent <= budget
      return { cat, budget, spent, over, under }
    })
  }, [store, today])

  if (!open || typeof document === 'undefined') return null

  const persistReflect = () => {
    store.saveWeekReflection(priorWeekStart, {
      ...reflection,
      patterns: reflection.patterns.filter((p) => p.pattern.trim() || p.evolution.trim()),
    })
  }

  const persistPriorGoals = () => {
    store.reviewWeeklyGoals(priorWeekStart, priorGoals)
  }

  const persistPlan = () => {
    store.commitWeeklyPlan(nextWeekStart, nextGoals, focus)
  }

  const advance = () => {
    if (step.id === 'reflect') persistReflect()
    if (step.id === 'prior-goals') persistPriorGoals()
    if (step.id === 'goals' || step.id === 'focus') {
      // commit plan when leaving focus (after goals set); also refresh if editing goals alone
      if (step.id === 'focus') persistPlan()
    }
    if (isLast) {
      persistPlan()
      store.completeAutopilot('sundayCenter', nextWeekStart)
      setFinished(true)
      return
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  const back = () => {
    if (finished) return
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  const updatePattern = (id: string, patch: Partial<WeekPattern>) => {
    setReflection((r) => ({
      ...r,
      patterns: r.patterns.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  const addPattern = () => {
    setReflection((r) => ({
      ...r,
      patterns: [...r.patterns, { id: uid('pat'), pattern: '', evolution: '' }],
    }))
  }

  const removePattern = (id: string) => {
    setReflection((r) => ({
      ...r,
      patterns: r.patterns.length <= 1 ? r.patterns : r.patterns.filter((p) => p.id !== id),
    }))
  }

  const addDumpTask = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = dumpText.trim()
    if (!trimmed) return
    store.addTask(dumpProject, trimmed, {
      plannedDate: dumpDate || null,
    })
    setDumpText('')
  }

  const goalsReady = nextGoals.filter((g) => g.text.trim()).length >= 1
  const focusReady = focus.trim().length > 0
  const canAdvance =
    step.id === 'goals'
      ? goalsReady
      : step.id === 'focus'
        ? focusReady
        : step.id === 'journal'
          ? journalDone
          : true

  return (
    <ModalPortal>
      <div className="wind-down-overlay" role="dialog" aria-modal aria-labelledby="sunday-center-title">
        <div className="wind-down-shell sunday-center-shell">
          <header className="wind-down-head">
            <div className="wind-down-brand">
              <span className="wind-down-kicker">Autopilot · Sunday Center</span>
              <h2 id="sunday-center-title">
                {finished ? 'Week centered' : step.title}
              </h2>
              <p className="wind-down-copy">
                {finished
                  ? 'Analysis locked. Plan loaded. Go execute — the center holds.'
                  : step.copy}
              </p>
            </div>
            <button type="button" className="x-btn visible" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          {!finished && (
            <ol className="wind-down-steps sunday-center-steps" aria-label="Sunday Center progress">
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
                  Sunday Center complete · planning week of {formatLongDate(nextWeekStart)}
                </p>
                <p className="sunday-rec-note">
                  Optional next week: glance energy/body (sleep, training, taper), clear open loops,
                  and scan the calendar for landmines before Monday.
                </p>
                <button type="button" className="btn-primary" onClick={onClose}>
                  Close
                </button>
              </div>
            ) : (
              <>
                {step.id === 'reflect' && (
                  <div className="sunday-panel">
                    <div className="sunday-pulse">
                      <span className="status-pill">WEEK PULSE</span>
                      <span>
                        Deep work hits {weekPulse.hits}/{weekPulse.days} ·{' '}
                        {formatMinutes(weekPulse.hours)} logged · target{' '}
                        {formatMinutes(weekPulse.target)}/day
                      </span>
                    </div>

                    <label className="field sunday-field">
                      <span className="field-label">1. What I did well and am proud of</span>
                      <textarea
                        rows={3}
                        value={reflection.proud}
                        onChange={(e) => setReflection((r) => ({ ...r, proud: e.target.value }))}
                        placeholder="Wins, courage, consistency…"
                      />
                    </label>

                    <div className="sunday-field">
                      <div className="sunday-field-head">
                        <span className="field-label">2. Patterns I noticed</span>
                        <button type="button" className="ghost-btn" onClick={addPattern}>
                          + Pattern
                        </button>
                      </div>
                      <div className="sunday-pattern-list">
                        {reflection.patterns.map((p, idx) => (
                          <div key={p.id} className="sunday-pattern-row">
                            <label className="field">
                              <span className="field-label">Pattern {idx + 1}</span>
                              <input
                                value={p.pattern}
                                onChange={(e) => updatePattern(p.id, { pattern: e.target.value })}
                                placeholder="What kept showing up?"
                              />
                            </label>
                            <label className="field">
                              <span className="field-label">Evolution</span>
                              <input
                                value={p.evolution}
                                onChange={(e) => updatePattern(p.id, { evolution: e.target.value })}
                                placeholder="What does this become / how do I shift it?"
                              />
                            </label>
                            <button
                              type="button"
                              className="x-btn visible"
                              aria-label="Remove pattern"
                              onClick={() => removePattern(p.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <label className="field sunday-field">
                      <span className="field-label">3. What I can improve on</span>
                      <textarea
                        rows={3}
                        value={reflection.improve}
                        onChange={(e) => setReflection((r) => ({ ...r, improve: e.target.value }))}
                        placeholder="One or two levers — not a self-attack list"
                      />
                    </label>

                    <div className="sunday-split-fields">
                      <label className="field sunday-field">
                        <span className="field-label">4. Where productivity fell short</span>
                        <textarea
                          rows={3}
                          value={reflection.productivityShortfall}
                          onChange={(e) =>
                            setReflection((r) => ({ ...r, productivityShortfall: e.target.value }))
                          }
                          placeholder="Where did the week leak?"
                        />
                      </label>
                      <label className="field sunday-field">
                        <span className="field-label">Remedy</span>
                        <textarea
                          rows={3}
                          value={reflection.productivityRemedy}
                          onChange={(e) =>
                            setReflection((r) => ({ ...r, productivityRemedy: e.target.value }))
                          }
                          placeholder="Concrete fix for next week"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {step.id === 'prior-goals' && (
                  <div className="sunday-panel">
                    <div className="sunday-pulse">
                      <span className="status-pill">WEEK OF {formatLongDate(priorWeekStart)}</span>
                      <span>Mark hit / miss and write the real why.</span>
                    </div>
                    {priorGoals.every((g) => !g.text.trim()) ? (
                      <p className="empty-tasks">No goals were set for last week — skip or note freeform below.</p>
                    ) : null}
                    <div className="sunday-goal-review-list">
                      {priorGoals.map((g, i) => (
                        <div key={g.id} className="sunday-goal-review">
                          <div className="sunday-goal-review-top">
                            <strong>Goal {i + 1}</strong>
                            <span>{g.text.trim() || '—'}</span>
                          </div>
                          {!g.text.trim() ? null : (
                            <>
                              <div className="sunday-hit-toggle" role="group" aria-label="Hit or miss">
                                <button
                                  type="button"
                                  className={`date-chip${g.hit === true ? ' active' : ''}`}
                                  onClick={() =>
                                    setPriorGoals((list) =>
                                      list.map((row) =>
                                        row.id === g.id ? { ...row, hit: true } : row,
                                      ),
                                    )
                                  }
                                >
                                  Hit
                                </button>
                                <button
                                  type="button"
                                  className={`date-chip${g.hit === false ? ' active' : ''}`}
                                  onClick={() =>
                                    setPriorGoals((list) =>
                                      list.map((row) =>
                                        row.id === g.id ? { ...row, hit: false } : row,
                                      ),
                                    )
                                  }
                                >
                                  Miss
                                </button>
                              </div>
                              <label className="field">
                                <span className="field-label">Why / why not</span>
                                <textarea
                                  rows={2}
                                  value={g.why}
                                  onChange={(e) =>
                                    setPriorGoals((list) =>
                                      list.map((row) =>
                                        row.id === g.id ? { ...row, why: e.target.value } : row,
                                      ),
                                    )
                                  }
                                  placeholder="Cause, not excuse"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step.id === 'finance' && (
                  <div className="sunday-panel">
                    <p className="sunday-finance-lede">
                      Personal set expenses for this period. Reduce amounts where you can. Green =
                      in budget, red = over.
                    </p>
                    <ul className="sunday-finance-list">
                      {financeRows.length === 0 && (
                        <li className="empty-tasks">No set expenses yet — add them in Personal Finances.</li>
                      )}
                      {financeRows.map(({ cat, budget, spent, over }) => (
                        <li key={cat.id} className={`sunday-finance-row${over ? ' over' : ' ok'}`}>
                          <div className="sunday-finance-main">
                            <strong>{cat.name}</strong>
                            <span className="sunday-finance-meta">
                              {cat.frequency} · spent {formatMoney(spent)} / {formatMoney(budget)}
                            </span>
                            <span className={`sunday-budget-pill${over ? ' over' : ''}`}>
                              {budget <= 0 ? 'No budget' : over ? 'Over' : 'In budget'}
                            </span>
                          </div>
                          <label className="sunday-finance-amount">
                            <span className="field-label">Set amount</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={cat.amount}
                              onChange={(e) => {
                                const n = Number(e.target.value)
                                if (Number.isNaN(n) || n < 0) return
                                store.updateExpenseCategory('personal', cat.id, { amount: n })
                              }}
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.id === 'goals' && (
                  <div className="sunday-panel">
                    <div className="sunday-pulse">
                      <span className="status-pill">WEEK OF {formatLongDate(nextWeekStart)}</span>
                      <span>These stay on your dashboard all week.</span>
                    </div>
                    <div className="sunday-goal-set-list">
                      {nextGoals.map((g, i) => (
                        <label key={g.id} className="field sunday-field">
                          <span className="field-label">Goal {i + 1}</span>
                          <input
                            value={g.text}
                            onChange={(e) =>
                              setNextGoals((list) =>
                                list.map((row) =>
                                  row.id === g.id ? { ...row, text: e.target.value } : row,
                                ),
                              )
                            }
                            placeholder={
                              i === 0
                                ? 'Primary outcome'
                                : i === 1
                                  ? 'Second lever'
                                  : 'Third lever / constraint'
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {step.id === 'focus' && (
                  <div className="sunday-panel sunday-focus-panel">
                    <label className="field sunday-field">
                      <span className="field-label">ACTUAL focus for the week</span>
                      <textarea
                        rows={5}
                        value={focus}
                        onChange={(e) => setFocus(e.target.value)}
                        placeholder="One sentence the week bends around. Settle the noise."
                      />
                    </label>
                    <p className="sunday-finance-lede">
                      This becomes your Week Intention — visible in Command Center under Mental OS.
                    </p>
                  </div>
                )}

                {step.id === 'tasks' && (
                  <div className="sunday-panel">
                    <form className="sunday-dump-form" onSubmit={addDumpTask}>
                      <label className="field">
                        <span className="field-label">Task</span>
                        <input
                          value={dumpText}
                          onChange={(e) => setDumpText(e.target.value)}
                          placeholder="Brain dump — press Add"
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">Category</span>
                        <select
                          className="field-select"
                          value={dumpProject}
                          onChange={(e) => setDumpProject(e.target.value as ProjectId)}
                        >
                          {PROJECTS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.id === 'personal'
                                ? 'Personal (week-critical)'
                                : p.id === 'sundayAdmin'
                                  ? 'Sunday Admin (Sunday only)'
                                  : p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="field-label">Date</span>
                        <input
                          type="date"
                          value={dumpDate}
                          onChange={(e) => setDumpDate(e.target.value)}
                        />
                      </label>
                      <button type="submit" className="btn-primary">
                        Add
                      </button>
                    </form>
                    <p className="sunday-finance-lede">
                      Dump freely. You can re-date in Evening Wind Down later in the week.
                    </p>
                  </div>
                )}

                {step.id === 'journal' && (
                  <div className="wind-down-panel wind-down-journal">
                    <div className="wind-down-journal-card">
                      <p className="wind-down-journal-prompt">
                        Paper only. Deep reflection and identity writing — who you were this week,
                        who you are becoming, and what must be true by next Sunday.
                      </p>
                      <p className="wind-down-journal-hint">
                        No typing here on purpose. The friction of ink is the point.
                      </p>
                      <label className="wind-down-check">
                        <input
                          type="checkbox"
                          checked={journalDone}
                          onChange={(e) => setJournalDone(e.target.checked)}
                        />
                        <span>Journal complete (on paper)</span>
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!finished && (
            <footer className="wind-down-foot">
              <button type="button" className="ghost-btn" onClick={back} disabled={stepIndex === 0}>
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={advance}
                disabled={!canAdvance}
              >
                {isLast
                  ? 'Complete Sunday Center'
                  : step.phase === 'Analysis' && step.id === 'finance'
                    ? 'Analysis done · plan next'
                    : 'Complete · next'}
              </button>
            </footer>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
