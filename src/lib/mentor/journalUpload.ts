/** Shared helpers for journal photo → OCR upload */

export async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
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
  const { base64, mediaType } = await fileToBase64(opts.file)
  const res = await fetch('/api/mentor/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      mediaType,
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
