'use client'

import { useEffect, useRef, useState } from 'react'
import { countFocusWords, isValidFocusNote, MIN_FOCUS_WORDS } from '../utils/focusNote'
import { Modal } from './ui/Modal'

export function SessionFocusNoteModal({
  open,
  projectName,
  projectColor,
  initialNote = '',
  onConfirm,
  onCancel,
}: {
  open: boolean
  projectName: string
  projectColor: string
  initialNote?: string
  onConfirm: (focusNote: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState(initialNote)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setNote(initialNote)
    const id = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [open, initialNote])

  const words = countFocusWords(note)
  const ready = isValidFocusNote(note)
  const remaining = Math.max(0, MIN_FOCUS_WORDS - words)

  const submit = () => {
    const trimmed = note.trim().replace(/\s+/g, ' ')
    if (!isValidFocusNote(trimmed)) return
    onConfirm(trimmed)
    setNote('')
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="What are you building?"
      size="md"
      className="session-focus-modal"
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={!ready} onClick={submit}>
            Start timer
          </button>
        </>
      }
    >
      <p className="session-focus-meta" style={{ ['--project-color' as string]: projectColor }}>
        <span className="session-focus-dot" aria-hidden />
        {projectName}
      </p>
      <p className="session-focus-copy">
        The note locks in before the clock starts. Five words minimum — the specific thing you are
        building, not what you are exploring.
      </p>

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
        {ready
          ? `${words} words — locked in. Start when ready.`
          : `${remaining} more word${remaining === 1 ? '' : 's'} to start`}
      </p>
    </Modal>
  )
}
