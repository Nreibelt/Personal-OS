import { pad2, todayDateKey, zonedParts } from './time'

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

function toKey(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null
  }
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function resolveYear(month: number, day: number, yearHint: number | null, now: Date): number {
  if (yearHint != null && yearHint >= 2000 && yearHint <= 2100) return yearHint
  const parts = zonedParts(now)
  const candidate = toKey(parts.year, month, day)
  if (!candidate) return parts.year
  // If the date is more than ~3 weeks in the future, it was likely last year
  const today = todayDateKey(now)
  if (candidate > today) {
    const [ty, tm, td] = today.split('-').map(Number)
    const todayIdx = ty * 372 + tm * 31 + td
    const candIdx = parts.year * 372 + month * 31 + day
    if (candIdx - todayIdx > 40) return parts.year - 1
  }
  return parts.year
}

/**
 * Parse human journal headers like "July 19th", "19 July 2026", "Jul 19", "2026-07-19".
 * Returns YYYY-MM-DD or null.
 */
export function parseFlexibleJournalDate(
  raw: string,
  now: Date = new Date(),
): string | null {
  if (!raw || typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text) return null

  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return toKey(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const numeric = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/)
  if (numeric) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    const y = Number(numeric[3])
    // Prefer D/M/Y when first > 12; else assume D/M/Y (operator is not US-default)
    if (a > 12) return toKey(y, b, a)
    if (b > 12) return toKey(y, a, b)
    return toKey(y, b, a)
  }

  // Prefer day-first ("19 July 2026") before month-first so years aren't eaten as days.
  const dayFirst = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b\.?(?:,?\s*(20\d{2}))?/i,
  )
  if (dayFirst) {
    const day = Number(dayFirst[1])
    const month = MONTHS[dayFirst[2].toLowerCase()]
    const yearHint = dayFirst[3] ? Number(dayFirst[3]) : null
    const year = resolveYear(month, day, yearHint, now)
    return toKey(year, month, day)
  }

  const monthFirst = text.match(
    /(?<!\d)\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)(?:,?\s*(20\d{2}))?/i,
  )
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()]
    const day = Number(monthFirst[2])
    const yearHint = monthFirst[3] ? Number(monthFirst[3]) : null
    const year = resolveYear(month, day, yearHint, now)
    return toKey(year, month, day)
  }

  return null
}

/** Pull a date from OCR text — first lines + "Page date:" markers. */
export function extractDateFromJournalText(text: string, now: Date = new Date()): {
  date: string | null
  raw: string | null
} {
  if (!text.trim()) return { date: null, raw: null }

  const pageDate = text.match(/page\s*date\s*[:\-]\s*(.+)/i)
  if (pageDate) {
    const raw = pageDate[1].split('\n')[0].trim()
    const date = parseFlexibleJournalDate(raw, now)
    if (date) return { date, raw }
  }

  const head = text.split(/\n/).slice(0, 4)
  for (const line of head) {
    const cleaned = line.replace(/^[#*\-\s]+/, '').trim()
    if (!cleaned || cleaned.length > 48) continue
    const date = parseFlexibleJournalDate(cleaned, now)
    if (date) return { date, raw: cleaned }
  }

  // Fallback: scan whole text for a month-name date
  const date = parseFlexibleJournalDate(text.slice(0, 400), now)
  if (date) return { date, raw: text.slice(0, 80) }
  return { date: null, raw: null }
}
