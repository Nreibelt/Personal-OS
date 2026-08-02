'use client'

import { useEffect, useRef, useState } from 'react'
import type { Store } from '../hooks/useStore'
import { prepareJournalImage } from '../lib/mentor/journalImage'
import { extractJournalPhoto, isJournalImageFile } from '../lib/mentor/journalUpload'
import { coerceJournalDateYear } from '../utils/journalDate'
import { todayDateKey } from '../utils/time'

type UploadDraft = {
  id: string
  file: File
  previewUrl: string
  previewReady: boolean
  date: string
  status: 'queued' | 'extracting' | 'done' | 'failed'
  error?: string
  detectedDateRaw?: string
}

function mid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function isHeicName(file: File) {
  return /\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)
}

async function buildPreviewUrl(file: File): Promise<string> {
  // Browsers often can't render HEIC — convert to JPEG for the thumbnail.
  if (isHeicName(file)) {
    const prepared = await prepareJournalImage(file)
    const binary = atob(prepared.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: prepared.mediaType })
    return URL.createObjectURL(blob)
  }
  return URL.createObjectURL(file)
}

function formatStatus(photo: UploadDraft) {
  if (photo.status === 'queued') return 'Ready'
  if (photo.status === 'extracting') return 'Reading…'
  if (photo.status === 'failed') return photo.error || 'Failed'
  if (photo.detectedDateRaw) return `Logged · ${photo.detectedDateRaw}`
  return `Logged · ${photo.date}`
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
  const [dragging, setDragging] = useState(false)
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
  const doneCount = uploads.filter((u) => u.status === 'done').length

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

        const pageDate = coerceJournalDateYear(result.detectedDate, result.detectedDateRaw)
        const usePage = preferPage && pageDate
        const finalDate = usePage ? pageDate : fallbackDate
        const dateSource = usePage ? 'extracted' : pageDate ? 'manual' : 'fallback'

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
    const accepted = Array.from(files).filter(isJournalImageFile)
    if (accepted.length === 0) return

    const next: UploadDraft[] = accepted.map((file) => ({
      id: mid('upload'),
      file,
      previewUrl: '',
      previewReady: false,
      date: bulkDate,
      status: 'queued' as const,
    }))

    setUploads((list) => [...list, ...next])
    setError(null)

    for (const draft of next) {
      void buildPreviewUrl(draft.file)
        .then((url) => {
          setUploads((list) =>
            list.map((u) =>
              u.id === draft.id ? { ...u, previewUrl: url, previewReady: true } : u,
            ),
          )
        })
        .catch(() => {
          setUploads((list) =>
            list.map((u) => (u.id === draft.id ? { ...u, previewReady: true } : u)),
          )
        })
    }
  }

  const removeUpload = (id: string) => {
    setUploads((list) => {
      const target = list.find((u) => u.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return list.filter((u) => u.id !== id)
    })
  }

  return (
    <div className={`journal-capture${compact ? ' compact' : ''}`}>
      {heading && <p className="journal-capture-heading">{heading}</p>}

      <div className="journal-capture-toolbar">
        <label className="journal-capture-date">
          <span className="field-label">Fallback date</span>
          <input
            type="date"
            value={bulkDate}
            onChange={(e) => setBulkDate(e.target.value || todayDateKey())}
          />
        </label>

        <button
          type="button"
          className={`journal-capture-switch${preferPage ? ' on' : ''}`}
          role="switch"
          aria-checked={preferPage}
          onClick={() => setPreferPage((v) => !v)}
        >
          <span className="journal-capture-switch-track" aria-hidden>
            <span className="journal-capture-switch-thumb" />
          </span>
          <span className="journal-capture-switch-copy">
            <strong>Read page date</strong>
            <small>Use header like “July 19th” when found</small>
          </span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="mentor-file-input"
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <button
        type="button"
        className={`journal-dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onFiles(e.dataTransfer.files)
        }}
      >
        <span className="journal-dropzone-icon" aria-hidden>
          <span />
          <span />
        </span>
        <span className="journal-dropzone-title">Add journal pages</span>
        <span className="journal-dropzone-meta">Drop photos or click · JPG · PNG · HEIC</span>
      </button>

      {(queuedCount > 0 || extracting) && (
        <div className="journal-capture-actions">
          <div className="journal-capture-queue-meta">
            <span>{queuedCount} ready</span>
            {doneCount > 0 && <span>{doneCount} logged</span>}
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={extracting || queuedCount === 0}
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
        <ul className="journal-page-list">
          {uploads.map((photo) => (
            <li key={photo.id} className={`journal-page-card status-${photo.status}`}>
              <div className="journal-page-thumb">
                {photo.previewUrl ? (
                  <img src={photo.previewUrl} alt="" />
                ) : (
                  <span className="journal-page-thumb-fallback" aria-hidden>
                    {isHeicName(photo.file) ? 'HEIC' : 'IMG'}
                  </span>
                )}
              </div>
              <div className="journal-page-body">
                <div className="journal-page-top">
                  <span className="journal-page-name" title={photo.file.name}>
                    {photo.file.name}
                  </span>
                  <span className={`journal-page-badge status-${photo.status}`}>
                    {formatStatus(photo)}
                  </span>
                </div>
                <label className="journal-page-date">
                  <span className="field-label">Date</span>
                  <input
                    type="date"
                    value={photo.date}
                    disabled={photo.status !== 'queued'}
                    onChange={(e) =>
                      setUploads((list) =>
                        list.map((u) =>
                          u.id === photo.id ? { ...u, date: e.target.value || bulkDate } : u,
                        ),
                      )
                    }
                    aria-label={`Date for ${photo.file.name}`}
                  />
                </label>
              </div>
              {photo.status === 'queued' && (
                <button
                  type="button"
                  className="journal-page-remove"
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
    </div>
  )
}
