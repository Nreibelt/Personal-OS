'use client'

import { useEffect, useRef, useState } from 'react'
import {
  countFocusWords,
  isValidFocusNote,
  isValidSessionTarget,
  MAX_SESSION_TARGET_MINUTES,
  MIN_FOCUS_WORDS,
  MIN_SESSION_TARGET_MINUTES,
  SESSION_TARGET_PRESETS,
} from '../utils/focusNote'
import { Modal } from './ui/Modal'

const MAX_BACKLOG_MINUTES = 12 * 60

export type SessionFocusConfirm = {
  focusNote: string
  targetMinutes: number
  startedMinutesAgo?: number
}

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
  onConfirm: (result: SessionFocusConfirm) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState(initialNote)
  const [minutesAgo, setMinutesAgo] = useState('')
  const [targetMinutes, setTargetMinutes] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setNote(initialNote)
    setMinutesAgo('')
    setTargetMinutes('')
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
  const parsedTarget = Number.parseInt(targetMinutes, 10)
  const targetOk = isValidSessionTarget(parsedTarget)
  const ready = readyNote && minutesOk && targetOk
  const remaining = Math.max(0, MIN_FOCUS_WORDS - words)

  const submit = () => {
    const trimmed = note.trim().replace(/\s+/g, ' ')
    if (!isValidFocusNote(trimmed)) return
    if (!isValidSessionTarget(parsedTarget)) return
    if (backlog) {
      if (!minutesOk) return
      onConfirm({ focusNote: trimmed, targetMinutes: parsedTarget, startedMinutesAgo: parsedMinutes })
    } else {
      onConfirm({ focusNote: trimmed, targetMinutes: parsedTarget })
    }
    setNote('')
    setMinutesAgo('')
    setTargetMinutes('')
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
          ? 'Forgot to hit start? Enter how long you have already been going, then lock your Slight Edge Focus and target.'
          : 'Lock these in before the clock starts. One edge to sharpen, and how long you plan to run.'}
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
        <span className="field-label">Slight Edge Focus</span>
        <span className="session-focus-sublabel">
          (1 thing to improve during this work session, e.g. mental model)
        </span>
        <textarea
          ref={inputRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              targetRef.current?.focus()
            }
          }}
          placeholder="e.g. mental model"
          rows={3}
          maxLength={200}
          aria-describedby="session-focus-hint"
        />
      </label>

      <label className="session-focus-minutes session-focus-target">
        <span className="field-label">Target timer</span>
        <span className="session-focus-sublabel">
          How long this block should run (minutes). Progress shows live against this.
        </span>
        <input
          ref={targetRef}
          type="number"
          inputMode="numeric"
          min={MIN_SESSION_TARGET_MINUTES}
          max={MAX_SESSION_TARGET_MINUTES}
          step={1}
          value={targetMinutes}
          onChange={(e) => setTargetMinutes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="e.g. 50"
          aria-describedby="session-target-hint"
        />
        <div className="session-focus-presets" role="group" aria-label="Target presets">
          {SESSION_TARGET_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`session-focus-preset${parsedTarget === preset ? ' active' : ''}`}
              onClick={() => setTargetMinutes(String(preset))}
            >
              {preset}m
            </button>
          ))}
        </div>
        <span id="session-target-hint" className="session-focus-minutes-hint">
          {MIN_SESSION_TARGET_MINUTES}–{MAX_SESSION_TARGET_MINUTES} minutes.
        </span>
      </label>

      <p id="session-focus-hint" className={`session-focus-hint${ready ? ' ready' : ''}`}>
        {!readyNote
          ? `${remaining} more word${remaining === 1 ? '' : 's'} to start`
          : !targetOk
            ? `Set a target (${MIN_SESSION_TARGET_MINUTES}+ min)`
            : backlog && !minutesOk
              ? 'Enter minutes already worked (1+)'
              : backlog
                ? `${words} words · ${parsedTarget}m target — timer will show ~${parsedMinutes}m already elapsed.`
                : `${words} words · ${parsedTarget}m target — locked in. Start when ready.`}
      </p>
    </Modal>
  )
}
