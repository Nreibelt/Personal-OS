import { coerceJournalDateYear } from '@/utils/journalDate'
import { zonedParts } from '@/utils/time'
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

  const currentYear = zonedParts().year
  const res = await fetch('/api/mentor/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: prepared.base64,
      mediaType: prepared.mediaType,
      date: opts.fallbackDate,
      sourceName: opts.sourceName || opts.file.name,
      currentYear,
    }),
  })
  const data = (await res.json()) as {
    text?: string
    detectedDate?: string | null
    detectedDateRaw?: string | null
    error?: string
  }
  if (!res.ok) throw new Error(data.error || 'Extraction failed')

  const detectedDateRaw =
    typeof data.detectedDateRaw === 'string' && data.detectedDateRaw.trim()
      ? data.detectedDateRaw.trim()
      : null
  const detectedDate = coerceJournalDateYear(
    typeof data.detectedDate === 'string' ? data.detectedDate : null,
    detectedDateRaw,
  )

  return {
    text: data.text || '',
    detectedDate,
    detectedDateRaw,
  }
}
