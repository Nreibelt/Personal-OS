import { isJournalImageFile, prepareJournalImage } from './journalImage'

export { isJournalImageFile }

export type JournalOcrResult = {
  text: string
  detectedDate: string | null
  detectedDateRaw: string | null
}

export async function extractJournalPhoto(opts: {
  file: File
  fallbackDate: string
  sourceName?: string
}): Promise<JournalOcrResult> {
  let prepared: Awaited<ReturnType<typeof prepareJournalImage>>
  try {
    prepared = await prepareJournalImage(opts.file)
  } catch {
    throw new Error(
      'Could not convert this photo (HEIC/HEIF). Try again, or export as JPG from Photos.',
    )
  }

  const res = await fetch('/api/mentor/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: prepared.base64,
      mediaType: prepared.mediaType,
      date: opts.fallbackDate,
      sourceName: opts.sourceName || opts.file.name,
    }),
  })
  const data = (await res.json()) as {
    text?: string
    detectedDate?: string | null
    detectedDateRaw?: string | null
    error?: string
  }
  if (!res.ok) throw new Error(data.error || 'Extraction failed')
  return {
    text: data.text || '',
    detectedDate:
      typeof data.detectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.detectedDate)
        ? data.detectedDate
        : null,
    detectedDateRaw:
      typeof data.detectedDateRaw === 'string' && data.detectedDateRaw.trim()
        ? data.detectedDateRaw.trim()
        : null,
  }
}
