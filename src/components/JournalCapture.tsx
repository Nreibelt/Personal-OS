'use client'

import { useEffect, useRef, useState } from 'react'
import type { Store } from '../hooks/useStore'
import { extractJournalPhoto } from '../lib/mentor/journalUpload'
import { todayDateKey } from '../utils/time'

type UploadDraft = {
  id: string
  file: File
  previewUrl: string
  date: string
  status: 'queued' | 'extracting' | 'done' | 'failed'
  error?: string
  detectedDateRaw?: string
}

function mid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function JournalCapture({
  store,
  defaultDate,
  preferPageDate = true,
  onExtractedCountChange,
  compact = false,
  heading,
}: {
  store: Store
  defaultDate: string
  /** When true, OCR date on the page wins over the fallback date (backfill mode). */
  preferPageDate?: boolean
  onExtractedCountChange?: (count: number) => void
  compact?: boolean
  heading?: string
}) {
  const [uploads, setUploads] = useState<UploadDraft[]>([])
  const [bulkDate, setBulkDate] = useState(defaultDate)
  const [preferPage, setPreferPage] = useState(preferPageDate)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const uploadsRef = useRef(uploads)
  uploadsRef.current = uploads
  const extractedSession = useRef(0)

  useEffect(() => {
    setBulkDate(defaultDate)
  }, [defaultDate])

  useEffect(() => {
    return () => {
      for (const u of uploadsRef.current) URL.revokeObjectURL(u.previewUrl)
    }
  }, [])

  const queuedCount = uploads.filter((u) => u.status === 'queued').length
  const extracting = uploads.some((u) => u.status === 'extracting')

  const extractUpload = (id: string) => {
    queueRef.current = queueRef.current.then(async () => {
      const item = uploadsRef.current.find((u) => u.id === id)
      if (!item || item.status !== 'queued') return

      const fallbackDate = item.date
      setUploads((list) =>
        list.map((u) => (u.id === id ? { ...u, status: 'extracting', error: undefined } : u)),
      )

      const pendingId = store.addJournalEntry({
        date: fallbackDate,
        sourceName: item.file.name,
        extractedText: '',
        status: 'pending',
        dateSource: 'fallback',
      })

      try {
        const result = await extractJournalPhoto({
          file: item.file,
          fallbackDate,
          sourceName: item.file.name,
        })

        const usePage = preferPage && result.detectedDate
        const finalDate = usePage ? result.detectedDate! : fallbackDate
        const dateSource = usePage ? 'extracted' : result.detectedDate ? 'manual' : 'fallback'

        store.updateJournalEntry(pendingId, {
          date: finalDate,
          extractedText: result.text,
          status: 'extracted',
          error: undefined,
          dateSource,
          detectedDateRaw: result.detectedDateRaw || undefined,
        })
        store.appendMentorMessage({
          role: 'system',
          text: result.detectedDate
            ? `Journal logged ${finalDate}${result.detectedDateRaw ? ` (page: ${result.detectedDateRaw})` : ''} — ${item.file.name}.`
            : `Journal logged ${finalDate} (${item.file.name}). No page date detected — used fallback.`,
        })

        extractedSession.current += 1
        onExtractedCountChange?.(extractedSession.current)

        setUploads((list) =>
          list.map((u) =>
            u.id === id
              ? {
                  ...u,
                  status: 'done',
                  date: finalDate,
                  detectedDateRaw: result.detectedDateRaw || undefined,
                }
              : u,
          ),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Extraction failed'
        store.updateJournalEntry(pendingId, { status: 'failed', error: message })
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

  return (
    <div className={`journal-capture${compact ? ' compact' : ''}`}>
      {heading && <p className="journal-capture-heading">{heading}</p>}
      <p className="journal-capture-copy">
        Photos of paper pages. Dates at the top (e.g. July 19th) are read automatically for
        backfill — Mentor analyzes by the real entry day.
      </p>

      <div className="journal-capture-controls">
        <label className="mentor-bulk-date">
          <span className="field-label">Fallback date</span>
          <input
            type="date"
            value={bulkDate}
            onChange={(e) => setBulkDate(e.target.value || todayDateKey())}
          />
        </label>
        <label className="journal-capture-toggle">
          <input
            type="checkbox"
            checked={preferPage}
            onChange={(e) => setPreferPage(e.target.checked)}
          />
          <span>Prefer date written on page</span>
        </label>
      </div>

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
        <span className="mentor-upload-title">Choose journal photos</span>
        <span className="mentor-upload-meta">Bulk upload OK — JPG, PNG, WEBP</span>
      </button>

      {queuedCount > 0 && (
        <div className="mentor-extract-bar">
          <button
            type="button"
            className="btn-primary"
            disabled={extracting}
            onClick={extractQueued}
          >
            {extracting
              ? 'Extracting…'
              : `Extract ${queuedCount} page${queuedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {error && (
        <p className="journal-capture-error" role="alert">
          {error}
        </p>
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
                  onChange={(e) =>
                    setUploads((list) =>
                      list.map((u) =>
                        u.id === photo.id
                          ? { ...u, date: e.target.value || bulkDate }
                          : u,
                      ),
                    )
                  }
                  aria-label={`Date for ${photo.file.name}`}
                />
                <span className={`mentor-photo-status status-${photo.status}`}>
                  {photo.status === 'queued' && 'Queued'}
                  {photo.status === 'extracting' && 'Extracting…'}
                  {photo.status === 'done' &&
                    (photo.detectedDateRaw
                      ? `Logged · ${photo.date} (${photo.detectedDateRaw})`
                      : `Logged · ${photo.date}`)}
                  {photo.status === 'failed' && (photo.error || 'Failed')}
                </span>
              </div>
              {photo.status === 'queued' && (
                <button
                  type="button"
                  className="x-btn visible"
                  aria-label={`Remove ${photo.file.name}`}
                  onClick={() =>
                    setUploads((list) => {
                      const target = list.find((u) => u.id === photo.id)
                      if (target) URL.revokeObjectURL(target.previewUrl)
                      return list.filter((u) => u.id !== photo.id)
                    })
                  }
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
