'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Store } from '../hooks/useStore'
import { buildMentorContext } from '../lib/mentor/context'
import type { MentorInsight } from '../types'
import { todayDateKey } from '../utils/time'

type UploadDraft = {
  id: string
  file: File
  previewUrl: string
  date: string
  status: 'queued' | 'extracting' | 'done' | 'failed'
  error?: string
}

function mid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const mediaType =
    file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif'
      ? file.type
      : 'image/jpeg'
  return { base64: btoa(binary), mediaType }
}

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
  const [uploads, setUploads] = useState<UploadDraft[]>([])
  const [bulkDate, setBulkDate] = useState(todayDateKey())
  const fileRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const uploadsRef = useRef(uploads)
  uploadsRef.current = uploads

  const debriefCount = useMemo(
    () => store.state.timeEntries.filter((e) => e.debrief).length,
    [store.state.timeEntries],
  )
  const journalReady = mentor.journalEntries.filter((j) => j.status === 'extracted').length
  const queuedCount = uploads.filter((u) => u.status === 'queued').length
  const extracting = uploads.some((u) => u.status === 'extracting')

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [mentor.messages, busy])

  useEffect(() => {
    return () => {
      for (const u of uploadsRef.current) URL.revokeObjectURL(u.previewUrl)
    }
  }, [])

  const extractUpload = (id: string) => {
    queueRef.current = queueRef.current.then(async () => {
      const item = uploadsRef.current.find((u) => u.id === id)
      if (!item || item.status !== 'queued') return

      const date = item.date
      setUploads((list) =>
        list.map((u) => (u.id === id ? { ...u, status: 'extracting', error: undefined } : u)),
      )

      const pendingId = store.addJournalEntry({
        date,
        sourceName: item.file.name,
        extractedText: '',
        status: 'pending',
      })

      try {
        const { base64, mediaType } = await fileToBase64(item.file)
        const res = await fetch('/api/mentor/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mediaType,
            date,
            sourceName: item.file.name,
          }),
        })
        const data = (await res.json()) as { text?: string; error?: string }
        if (!res.ok) throw new Error(data.error || 'Extraction failed')

        store.updateJournalEntry(pendingId, {
          extractedText: data.text || '',
          status: 'extracted',
          error: undefined,
        })
        store.appendMentorMessage({
          role: 'system',
          text: `Journal page logged for ${date} (${item.file.name}). Text is in the mentor loop.`,
        })
        setUploads((list) => list.map((u) => (u.id === id ? { ...u, status: 'done' } : u)))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Extraction failed'
        store.updateJournalEntry(pendingId, {
          status: 'failed',
          error: message,
        })
        setUploads((list) =>
          list.map((u) => (u.id === id ? { ...u, status: 'failed', error: message } : u)),
        )
        setError(message)
      }
    })
  }

  const extractQueued = () => {
    const ids = uploadsRef.current.filter((u) => u.status === 'queued').map((u) => u.id)
    for (const id of ids) extractUpload(id)
  }

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
      text: 'Running full synthesis across deep work, breaks, debriefs, spend, journals, and Sunday logs…',
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

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    const next: UploadDraft[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      next.push({
        id: mid('upload'),
        file,
        previewUrl: URL.createObjectURL(file),
        date: bulkDate,
        status: 'queued',
      })
    }
    if (next.length === 0) return
    setUploads((list) => [...list, ...next])
    setError(null)
  }

  const setUploadDate = (id: string, date: string) => {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, date } : u)))
  }

  const removeUpload = (id: string) => {
    setUploads((list) => {
      const target = list.find((u) => u.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return list.filter((u) => u.id !== id)
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
              Second set of eyes on your OS — sessions, breaks, spend, journals, Sunday logs.
              Pattern recognition built to expose blind spots and install what lets you dominate.
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
            <span className="mentor-signal-value">{store.state.personalFinance.spends.length}</span>
            <span className="mentor-signal-label">Spends</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="mentor-error" role="alert">
          {error}
          <button type="button" className="ghost-btn" onClick={() => setError(null)}>
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
              <InsightPanel insight={insight} />
            ) : (
              <p className="mentor-empty">
                No synthesis yet. Finish sessions with debriefs, upload journals, then run full
                synthesis.
              </p>
            )}
          </section>

          <section className="mentor-journal" aria-label="Journal photo upload">
            <header className="mentor-panel-head">
              <span className="field-label">Journal photos</span>
              <span className="status-pill">VISION OCR</span>
            </header>

            <p className="mentor-journal-copy">
              Bulk-upload paper pages. Tag each with a date — text is extracted and fed into every
              mentor read.
            </p>

            <label className="mentor-bulk-date">
              <span className="field-label">Default date for next batch</span>
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value || todayDateKey())}
              />
            </label>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="mentor-file-input"
              onChange={(e) => {
                onFiles(e.target.files)
                e.target.value = ''
              }}
            />

            <button
              type="button"
              className="mentor-upload-zone"
              onClick={() => fileRef.current?.click()}
            >
              <span className="mentor-upload-title">Drop or choose photos</span>
              <span className="mentor-upload-meta">JPG, PNG, WEBP — multiple pages ok</span>
            </button>

            {queuedCount > 0 && (
              <div className="mentor-extract-bar">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={extracting}
                  onClick={extractQueued}
                >
                  {extracting ? 'Extracting…' : `Extract ${queuedCount} page${queuedCount === 1 ? '' : 's'}`}
                </button>
              </div>
            )}

            {uploads.length > 0 && (
              <ul className="mentor-photo-grid">
                {uploads.map((photo) => (
                  <li key={photo.id} className="mentor-photo">
                    <img src={photo.previewUrl} alt={photo.file.name} />
                    <div className="mentor-photo-meta">
                      <span className="mentor-photo-name">{photo.file.name}</span>
                      <input
                        type="date"
                        value={photo.date}
                        disabled={photo.status !== 'queued'}
                        onChange={(e) => setUploadDate(photo.id, e.target.value || bulkDate)}
                        aria-label={`Date for ${photo.file.name}`}
                      />
                      <span className={`mentor-photo-status status-${photo.status}`}>
                        {photo.status === 'queued' && 'Queued'}
                        {photo.status === 'extracting' && 'Extracting…'}
                        {photo.status === 'done' && 'Logged'}
                        {photo.status === 'failed' && (photo.error || 'Failed')}
                      </span>
                    </div>
                    {photo.status === 'queued' && (
                      <button
                        type="button"
                        className="x-btn visible"
                        aria-label={`Remove ${photo.file.name}`}
                        onClick={() => removeUpload(photo.id)}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {mentor.journalEntries.length > 0 && (
              <ul className="mentor-journal-list">
                {mentor.journalEntries.slice(0, 8).map((entry) => (
                  <li key={entry.id} className="mentor-journal-item">
                    <div className="mentor-journal-item-head">
                      <strong>{entry.date}</strong>
                      <span>{entry.sourceName}</span>
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
                      {entry.status === 'extracted' && entry.extractedText.length > 220 ? '…' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function InsightPanel({ insight }: { insight: MentorInsight }) {
  return (
    <div className="mentor-insight-body">
      <p className="mentor-insight-summary">{insight.summary}</p>
      <InsightList title="Weapon conditions" items={insight.weapons} tone="weapon" />
      <InsightList title="What drags you" items={insight.drags} tone="drag" />
      <InsightList title="Blind spots" items={insight.blindSpots} tone="blind" />
      <InsightList title="Install next" items={insight.prescriptions} tone="rx" />
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
