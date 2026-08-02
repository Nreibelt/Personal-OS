'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Store } from '../hooks/useStore'
import { buildMentorContext } from '../lib/mentor/context'
import type { MentorInsight } from '../types'
import { addDays, todayDateKey } from '../utils/time'
import { JournalCapture } from './JournalCapture'

function formatInsightTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

export function MentorView({ store }: { store: Store }) {
  const mentor = store.state.mentor
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'chat' | 'analyze' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [installNote, setInstallNote] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  const debriefCount = useMemo(
    () => store.state.timeEntries.filter((e) => e.debrief).length,
    [store.state.timeEntries],
  )
  const journalReady = mentor.journalEntries.filter((j) => j.status === 'extracted').length

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [mentor.messages, busy])

  const sendChat = async (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    setError(null)
    setBusy('chat')
    store.appendMentorMessage({ role: 'user', text })

    try {
      const history = [...store.state.mentor.messages]
        .filter((m) => m.role === 'user' || m.role === 'mentor')
        .slice(-16)
        .map((m) => ({
          role: m.role === 'mentor' ? ('assistant' as const) : ('user' as const),
          content: m.text,
        }))

      const res = await fetch('/api/mentor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: buildMentorContext(store.state),
          history: history.slice(0, -1),
        }),
      })
      const data = (await res.json()) as { reply?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'Mentor unavailable')
      store.appendMentorMessage({ role: 'mentor', text: data.reply || '…' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mentor chat failed'
      setError(message)
      store.appendMentorMessage({
        role: 'system',
        text: `Chat failed: ${message}`,
      })
    } finally {
      setBusy(null)
    }
  }

  const runSynthesis = async () => {
    if (busy) return
    setError(null)
    setBusy('analyze')
    store.appendMentorMessage({
      role: 'system',
      text: 'Running full synthesis across deep work, breaks, debriefs, body, spend, journals, and Sunday logs…',
    })

    try {
      const res = await fetch('/api/mentor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: buildMentorContext(store.state) }),
      })
      const data = (await res.json()) as {
        insight?: {
          summary: string
          weapons: string[]
          drags: string[]
          blindSpots: string[]
          prescriptions: string[]
          chatReply: string
        }
        error?: string
      }
      if (!res.ok || !data.insight) throw new Error(data.error || 'Synthesis failed')

      const saved = store.saveMentorInsight({
        summary: data.insight.summary,
        weapons: data.insight.weapons,
        drags: data.insight.drags,
        blindSpots: data.insight.blindSpots,
        prescriptions: data.insight.prescriptions,
      })
      store.appendMentorMessage({
        role: 'mentor',
        text: data.insight.chatReply || saved.summary,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Synthesis failed'
      setError(message)
      store.appendMentorMessage({
        role: 'system',
        text: `Synthesis failed: ${message}`,
      })
    } finally {
      setBusy(null)
    }
  }

  const installPrescription = (
    insightId: string,
    text: string,
    kind: 'habit' | 'oneThing' | 'calendar' | 'reminder',
  ) => {
    const clean = text.trim()
    if (!clean) return
    const short = clean.length > 72 ? `${clean.slice(0, 72)}…` : clean
    const today = todayDateKey()
    const tomorrow = addDays(today, 1)

    if (kind === 'habit') {
      store.addHabit(short)
      setInstallNote(`Installed as non-negotiable: ${short}`)
    } else if (kind === 'oneThing') {
      store.setOneThing(today, clean)
      setInstallNote('Set as today’s One Thing.')
    } else if (kind === 'calendar') {
      store.addCalendarBlock({
        title: short,
        date: tomorrow,
        startMinutes: 9 * 60,
        endMinutes: 10 * 60 + 30,
      })
      setInstallNote(`Calendar block tomorrow 9:00–10:30: ${short}`)
    } else {
      store.addReminder(short)
      setInstallNote(`Reminder added: ${short}`)
    }

    store.markPrescriptionInstalled(insightId, text)
    store.appendMentorMessage({
      role: 'system',
      text: `Installed prescription (${kind}): ${clean}`,
    })
  }

  const insight = mentor.latestInsight

  return (
    <div className="layout-stack mentor-view">
      <section className="action-board">
        <header className="action-board-head mentor-hero-head">
          <div>
            <h2 className="action-board-title">Mentor</h2>
            <p className="action-board-copy">
              Second set of eyes — sessions, body, breaks, spend, journals, Sunday logs. Spot
              blind spots. Install constraints. Dominate.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary mentor-synthesize-btn"
            onClick={() => void runSynthesis()}
            disabled={busy !== null}
          >
            {busy === 'analyze' ? 'Synthesizing…' : 'Run full synthesis'}
          </button>
        </header>

        <div className="mentor-signal-row" aria-label="Mentor data signals">
          <div className="mentor-signal">
            <span className="mentor-signal-value">{store.state.timeEntries.length}</span>
            <span className="mentor-signal-label">Sessions</span>
          </div>
          <div className="mentor-signal">
            <span className="mentor-signal-value">{debriefCount}</span>
            <span className="mentor-signal-label">Debriefs</span>
          </div>
          <div className="mentor-signal">
            <span className="mentor-signal-value">{journalReady}</span>
            <span className="mentor-signal-label">Journal pages</span>
          </div>
          <div className="mentor-signal">
            <span className="mentor-signal-value">
              {Object.keys(store.state.bodyLogs || {}).length}
            </span>
            <span className="mentor-signal-label">Body logs</span>
          </div>
        </div>
      </section>

      {(error || installNote) && (
        <div className={error ? 'mentor-error' : 'mentor-install-toast'} role="status">
          {error || installNote}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setError(null)
              setInstallNote(null)
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mentor-layout">
        <section className="mentor-chat" aria-label="Mentor chat">
          <header className="mentor-panel-head">
            <span className="field-label">Chat</span>
            <span className={`status-pill${busy ? ' live' : ''}`}>
              {busy === 'chat' ? 'THINKING' : busy === 'analyze' ? 'SYNTHESIS' : 'LIVE'}
            </span>
          </header>

          <div className="mentor-thread" ref={threadRef}>
            {mentor.messages.map((msg) => (
              <div key={msg.id} className={`mentor-bubble mentor-bubble-${msg.role}`}>
                <span className="mentor-bubble-role">
                  {msg.role === 'user' ? 'You' : msg.role === 'mentor' ? 'Mentor' : 'System'}
                </span>
                <p>{msg.text}</p>
              </div>
            ))}
            {busy === 'chat' && (
              <div className="mentor-bubble mentor-bubble-mentor mentor-bubble-pending">
                <span className="mentor-bubble-role">Mentor</span>
                <p>Reading the dossier…</p>
              </div>
            )}
          </div>

          <form className="mentor-compose" onSubmit={(e) => void sendChat(e)}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Where am I leaking? What makes me a weapon? What should I install this week?"
              rows={3}
              aria-label="Message mentor"
              disabled={busy !== null}
            />
            <button type="submit" className="btn-primary" disabled={!draft.trim() || busy !== null}>
              Send
            </button>
          </form>
        </section>

        <div className="mentor-side">
          <section className="mentor-insight" aria-label="Latest synthesis">
            <header className="mentor-panel-head">
              <span className="field-label">Blind-spot board</span>
              {insight && (
                <span className="mentor-insight-when">{formatInsightTime(insight.createdAt)}</span>
              )}
            </header>
            {insight ? (
              <InsightPanel
                insight={insight}
                onInstall={(text, kind) => installPrescription(insight.id, text, kind)}
              />
            ) : (
              <p className="mentor-empty">
                No synthesis yet. Finish sessions with debriefs, log body, upload journals, then
                run full synthesis.
              </p>
            )}
          </section>

          <section className="mentor-journal" aria-label="Journal photo upload">
            <header className="mentor-panel-head">
              <span className="field-label">Journal backfill</span>
              <span className="status-pill">DATE OCR</span>
            </header>
            <div className="mentor-journal-body">
              <JournalCapture store={store} defaultDate={todayDateKey()} preferPageDate />
              {mentor.journalEntries.length > 0 && (
                <ul className="mentor-journal-list">
                  {mentor.journalEntries.slice(0, 10).map((entry) => (
                    <li key={entry.id} className="mentor-journal-item">
                      <div className="mentor-journal-item-head">
                        <strong>{entry.date}</strong>
                        <span>
                          {entry.sourceName}
                          {entry.detectedDateRaw ? ` · page: ${entry.detectedDateRaw}` : ''}
                          {entry.dateSource === 'extracted' ? ' · auto-dated' : ''}
                        </span>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => store.removeJournalEntry(entry.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <p>
                        {entry.status === 'failed'
                          ? entry.error || 'Failed'
                          : entry.status === 'pending'
                            ? 'Extracting…'
                            : entry.extractedText.slice(0, 220) || '(empty)'}
                        {entry.status === 'extracted' && entry.extractedText.length > 220
                          ? '…'
                          : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function InsightPanel({
  insight,
  onInstall,
}: {
  insight: MentorInsight
  onInstall: (text: string, kind: 'habit' | 'oneThing' | 'calendar' | 'reminder') => void
}) {
  return (
    <div className="mentor-insight-body">
      <p className="mentor-insight-summary">{insight.summary}</p>
      <InsightList title="Weapon conditions" items={insight.weapons} tone="weapon" />
      <InsightList title="What drags you" items={insight.drags} tone="drag" />
      <InsightList title="Blind spots" items={insight.blindSpots} tone="blind" />
      <div className="mentor-insight-list tone-rx">
        <span className="field-label">Install next</span>
        {insight.prescriptions.length === 0 ? (
          <p className="mentor-empty" style={{ padding: '0.5rem 0' }}>
            No prescriptions this round.
          </p>
        ) : (
          <ul className="mentor-rx-list">
            {insight.prescriptions.map((item) => {
              const installed = insight.installed?.includes(item)
              return (
                <li key={item} className={`mentor-rx-item${installed ? ' installed' : ''}`}>
                  <p>{item}</p>
                  {installed ? (
                    <span className="status-pill hit">INSTALLED</span>
                  ) : (
                    <div className="mentor-rx-actions">
                      <button type="button" className="btn-secondary compact" onClick={() => onInstall(item, 'habit')}>
                        Habit
                      </button>
                      <button type="button" className="btn-secondary compact" onClick={() => onInstall(item, 'oneThing')}>
                        One Thing
                      </button>
                      <button type="button" className="btn-secondary compact" onClick={() => onInstall(item, 'calendar')}>
                        Block
                      </button>
                      <button type="button" className="btn-secondary compact" onClick={() => onInstall(item, 'reminder')}>
                        Reminder
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function InsightList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'weapon' | 'drag' | 'blind' | 'rx'
}) {
  if (items.length === 0) return null
  return (
    <div className={`mentor-insight-list tone-${tone}`}>
      <span className="field-label">{title}</span>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
