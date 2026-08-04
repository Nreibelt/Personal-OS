'use client'

import { useEffect, useRef, useState } from 'react'
import { countFocusWords, isValidFocusNote, MIN_FOCUS_WORDS } from '../utils/focusNote'
import { Modal } from './ui/Modal'

const MAX_BACKLOG_MINUTES = 12 * 60

export function SessionFocusNoteModal({
  open,
  projectName,
  projectColor,
  initialNote = '',
  backlog = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  projectName: string
  projectColor: string
  initialNote?: string
  /** When true, also ask how many minutes ago the session already started. */
  backlog?: boolean
  onConfirm: (focusNote: string, startedMinutesAgo?: number) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState(initialNote)
  const [minutesAgo, setMinutesAgo] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setNote(initialNote)
    setMinutesAgo('')
    const id = window.setTimeout(() => {
      if (backlog) minutesRef.current?.focus()
      else inputRef.current?.focus()
    }, 40)
    return () => window.clearTimeout(id)
  }, [open, initialNote, backlog])

  const words = countFocusWords(note)
  const readyNote = isValidFocusNote(note)
  const parsedMinutes = Number.parseInt(minutesAgo, 10)
  const minutesOk =
    !backlog ||
    (Number.isFinite(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= MAX_BACKLOG_MINUTES)
  const ready = readyNote && minutesOk
  const remaining = Math.max(0, MIN_FOCUS_WORDS - words)

  const submit = () => {
    const trimmed = note.trim().replace(/\s+/g, ' ')
    if (!isValidFocusNote(trimmed)) return
    if (backlog) {
      if (!minutesOk) return
      onConfirm(trimmed, parsedMinutes)
    } else {
      onConfirm(trimmed)
    }
    setNote('')
    setMinutesAgo('')
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={backlog ? 'Backlog a session' : 'What are you building?'}
      size="md"
      className="session-focus-modal"
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={!ready} onClick={submit}>
            {backlog ? 'Start from then' : 'Start timer'}
          </button>
        </>
      }
    >
      <p className="session-focus-meta" style={{ ['--project-color' as string]: projectColor }}>
        <span className="session-focus-dot" aria-hidden />
        {projectName}
      </p>
      <p className="session-focus-copy">
        {backlog
          ? 'Forgot to hit start? Enter how long you have already been going, then lock the build note.'
          : 'The note locks in before the clock starts. Five words minimum — the specific thing you are building, not what you are exploring.'}
      </p>

      {backlog && (
        <label className="session-focus-minutes">
          <span className="field-label">Started how many minutes ago?</span>
          <input
            ref={minutesRef}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_BACKLOG_MINUTES}
            step={1}
            value={minutesAgo}
            onChange={(e) => setMinutesAgo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                inputRef.current?.focus()
              }
            }}
            placeholder="e.g. 25"
            aria-describedby="session-backlog-hint"
          />
          <span id="session-backlog-hint" className="session-focus-minutes-hint">
            Timer opens already running from that mark (max {MAX_BACKLOG_MINUTES} min).
          </span>
        </label>
      )}

      <label className="session-focus-note">
        <span className="field-label">Session note</span>
        <textarea
          ref={inputRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="e.g. Ship Chase login error states"
          rows={3}
          maxLength={200}
          aria-describedby="session-focus-hint"
        />
      </label>

      <p id="session-focus-hint" className={`session-focus-hint${ready ? ' ready' : ''}`}>
        {!readyNote
          ? `${remaining} more word${remaining === 1 ? '' : 's'} to start`
          : backlog && !minutesOk
            ? 'Enter minutes already worked (1+)'
            : backlog
              ? `${words} words — timer will show ~${parsedMinutes}m already elapsed.`
              : `${words} words — locked in. Start when ready.`}
      </p>
    </Modal>
  )
}
