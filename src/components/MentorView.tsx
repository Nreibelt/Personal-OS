'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

type ChatRole = 'user' | 'mentor' | 'system'

type ChatMessage = {
  id: string
  role: ChatRole
  text: string
}

type JournalPhoto = {
  id: string
  name: string
  previewUrl: string
  status: 'queued' | 'ready'
}

function mid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function MentorView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      text: 'Mentor skeleton ready. Claude wiring lands tomorrow — pattern recognition across deep work, finances, Sunday logs, and tasks.',
    },
  ])
  const [draft, setDraft] = useState('')
  const [photos, setPhotos] = useState<JournalPhoto[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    return () => {
      for (const photo of photos) URL.revokeObjectURL(photo.previewUrl)
    }
  }, [photos])

  const send = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((list) => [
      ...list,
      { id: mid('msg'), role: 'user', text },
      {
        id: mid('msg'),
        role: 'mentor',
        text: 'Claude not connected yet. Your message is staged — synthesis comes online tomorrow.',
      },
    ])
    setDraft('')
  }

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    const next: JournalPhoto[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      next.push({
        id: mid('photo'),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        status: 'queued',
      })
    }
    if (next.length === 0) return
    setPhotos((list) => [...next, ...list])
    setMessages((list) => [
      ...list,
      {
        id: mid('msg'),
        role: 'system',
        text: `${next.length} journal photo${next.length === 1 ? '' : 's'} queued for text extraction. OCR + Claude tomorrow.`,
      },
    ])
  }

  const removePhoto = (id: string) => {
    setPhotos((list) => {
      const target = list.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return list.filter((p) => p.id !== id)
    })
  }

  return (
    <div className="layout-stack mentor-view">
      <section className="action-board">
        <header className="action-board-head">
          <h2 className="action-board-title">Mentor</h2>
          <p className="action-board-copy">
            Pattern recognition across your OS — deep work, money, Sunday logs, tasks, vision.
            Claude wires in tomorrow.
          </p>
        </header>
      </section>

      <div className="mentor-layout">
        <section className="mentor-chat" aria-label="Mentor chat">
          <header className="mentor-panel-head">
            <span className="field-label">Chat</span>
            <span className="status-pill">CLAUDE SOON</span>
          </header>

          <div className="mentor-thread" ref={threadRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`mentor-bubble mentor-bubble-${msg.role}`}>
                <span className="mentor-bubble-role">
                  {msg.role === 'user' ? 'You' : msg.role === 'mentor' ? 'Mentor' : 'System'}
                </span>
                <p>{msg.text}</p>
              </div>
            ))}
          </div>

          <form className="mentor-compose" onSubmit={send}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask for patterns, blind spots, or a read on the week…"
              rows={3}
              aria-label="Message mentor"
            />
            <button type="submit" className="btn-primary" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </section>

        <section className="mentor-journal" aria-label="Journal photo upload">
          <header className="mentor-panel-head">
            <span className="field-label">Journal photos</span>
            <span className="status-pill">OCR SOON</span>
          </header>

          <p className="mentor-journal-copy">
            Upload pages from paper journaling. Tomorrow these extract to text and feed the mentor
            loop.
          </p>

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
            <span className="mentor-upload-meta">JPG, PNG, HEIC — multiple pages ok</span>
          </button>

          {photos.length > 0 && (
            <ul className="mentor-photo-grid">
              {photos.map((photo) => (
                <li key={photo.id} className="mentor-photo">
                  <img src={photo.previewUrl} alt={photo.name} />
                  <div className="mentor-photo-meta">
                    <span className="mentor-photo-name">{photo.name}</span>
                    <span className="mentor-photo-status">Queued</span>
                  </div>
                  <button
                    type="button"
                    className="x-btn visible"
                    aria-label={`Remove ${photo.name}`}
                    onClick={() => removePhoto(photo.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
