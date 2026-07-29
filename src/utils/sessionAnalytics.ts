import type { PauseSegment, SummaryMode, TimeEntry } from '../types'
import { APP_TIMEZONE, addDays, weekDays } from './time'

export interface SessionStats {
  count: number
  totalMinutes: number
  avgMinutes: number
  medianMinutes: number
  minMinutes: number
  maxMinutes: number
  /** Sessions with timestamp data (for time-of-day charts) */
  timestampedCount: number
}

export interface DurationBucket {
  label: string
  count: number
  pct: number
}

export interface HourBucket {
  hour: number
  label: string
  sessionCount: number
  avgSessionMinutes: number
  totalMinutes: number
}

export interface PauseHourBucket {
  hour: number
  label: string
  pauseCount: number
  totalPauseMinutes: number
  avgPauseMinutes: number
}

export interface PauseStats {
  totalPauses: number
  totalPauseMinutes: number
  avgPauseMinutes: number
  sessionsWithPauses: number
  pauseRate: number
  /** Pauses with timestamp data */
  timestampedPauseCount: number
}

const DURATION_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '<25m', min: 0, max: 25 },
  { label: '25–45m', min: 25, max: 45 },
  { label: '45–90m', min: 45, max: 90 },
  { label: '90m+', min: 90, max: Infinity },
]

function hourLabel(h: number): string {
  if (h === 0) return '12a'
  if (h < 12) return `${h}a`
  if (h === 12) return '12p'
  return `${h - 12}p`
}

/** Hour (0–23) for an epoch ms in the app timezone. */
export function hourInAppTz(epochMs: number, timeZone = APP_TIMEZONE): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  })
  return Number(fmt.format(new Date(epochMs)))
}

export function filterEntriesByScope(
  entries: TimeEntry[],
  scope: SummaryMode,
  selectedDate: string,
): TimeEntry[] {
  if (scope === 'day') return entries.filter((e) => e.date === selectedDate)
  if (scope === 'week') {
    const days = new Set(weekDays(selectedDate))
    return entries.filter((e) => days.has(e.date))
  }
  return entries
}

export function sessionDurationMinutes(entry: TimeEntry): number {
  if (entry.startedAt != null && entry.endedAt != null) {
    return Math.max(1, Math.round((entry.endedAt - entry.startedAt) / 60000))
  }
  return entry.minutes
}

export function activeWorkMinutes(entry: TimeEntry): number {
  return entry.minutes
}

export function computeSessionStats(entries: TimeEntry[]): SessionStats {
  if (entries.length === 0) {
    return {
      count: 0,
      totalMinutes: 0,
      avgMinutes: 0,
      medianMinutes: 0,
      minMinutes: 0,
      maxMinutes: 0,
      timestampedCount: 0,
    }
  }

  const durations = entries.map((e) => activeWorkMinutes(e))
  const sorted = [...durations].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

  return {
    count: entries.length,
    totalMinutes: durations.reduce((s, d) => s + d, 0),
    avgMinutes: Math.round(durations.reduce((s, d) => s + d, 0) / entries.length),
    medianMinutes: Math.round(median),
    minMinutes: sorted[0],
    maxMinutes: sorted[sorted.length - 1],
    timestampedCount: entries.filter((e) => e.startedAt != null).length,
  }
}

export function computeDurationBuckets(entries: TimeEntry[]): DurationBucket[] {
  if (entries.length === 0) {
    return DURATION_BUCKETS.map((b) => ({ label: b.label, count: 0, pct: 0 }))
  }
  return DURATION_BUCKETS.map((bucket) => {
    const count = entries.filter((e) => {
      const m = activeWorkMinutes(e)
      return m >= bucket.min && (bucket.max === Infinity ? true : m < bucket.max)
    }).length
    return { label: bucket.label, count, pct: Math.round((count / entries.length) * 100) }
  })
}

export function aggregateSessionsByHour(entries: TimeEntry[]): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    sessionCount: 0,
    avgSessionMinutes: 0,
    totalMinutes: 0,
  }))

  const hourSessions: number[][] = Array.from({ length: 24 }, () => [])

  for (const entry of entries) {
    if (entry.startedAt == null) continue
    const hour = hourInAppTz(entry.startedAt)
    const mins = activeWorkMinutes(entry)
    hourSessions[hour].push(mins)
    buckets[hour].sessionCount += 1
    buckets[hour].totalMinutes += mins
  }

  for (let h = 0; h < 24; h++) {
    const sessions = hourSessions[h]
    buckets[h].avgSessionMinutes =
      sessions.length > 0
        ? Math.round(sessions.reduce((s, m) => s + m, 0) / sessions.length)
        : 0
  }

  return buckets
}

export function collectPauseSegments(entries: TimeEntry[]): PauseSegment[] {
  const segments: PauseSegment[] = []
  for (const entry of entries) {
    if (entry.pauses?.length) {
      segments.push(...entry.pauses)
    } else if (entry.pauseCount && entry.pauseCount > 0 && entry.pausedMinutes) {
      // Legacy: distribute synthetic pause at session midpoint if no segments
      if (entry.startedAt != null) {
        const mid = entry.startedAt + ((entry.endedAt ?? entry.startedAt) - entry.startedAt) / 2
        segments.push({
          startedAt: mid,
          durationMs: entry.pausedMinutes * 60000,
        })
      }
    }
  }
  return segments
}

export function computePauseStats(entries: TimeEntry[]): PauseStats {
  const segments = collectPauseSegments(entries)
  const sessionsWithPauses = entries.filter(
    (e) => (e.pauseCount ?? 0) > 0 || (e.pausedMinutes ?? 0) > 0,
  ).length

  const totalPauseMinutes = entries.reduce((s, e) => s + (e.pausedMinutes ?? 0), 0)
  const totalPauses = entries.reduce((s, e) => s + (e.pauseCount ?? 0), 0)

  return {
    totalPauses,
    totalPauseMinutes,
    avgPauseMinutes: totalPauses > 0 ? Math.round(totalPauseMinutes / totalPauses) : 0,
    sessionsWithPauses,
    pauseRate: entries.length > 0 ? Math.round((sessionsWithPauses / entries.length) * 100) : 0,
    timestampedPauseCount: segments.length,
  }
}

export function aggregatePausesByHour(entries: TimeEntry[]): PauseHourBucket[] {
  const buckets: PauseHourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    pauseCount: 0,
    totalPauseMinutes: 0,
    avgPauseMinutes: 0,
  }))

  const hourDurations: number[][] = Array.from({ length: 24 }, () => [])

  for (const seg of collectPauseSegments(entries)) {
    const hour = hourInAppTz(seg.startedAt)
    const mins = seg.durationMs / 60000
    buckets[hour].pauseCount += 1
    buckets[hour].totalPauseMinutes += mins
    hourDurations[hour].push(mins)
  }

  for (let h = 0; h < 24; h++) {
    const durations = hourDurations[h]
    buckets[h].totalPauseMinutes = Math.round(buckets[h].totalPauseMinutes)
    buckets[h].avgPauseMinutes =
      durations.length > 0
        ? Math.round(durations.reduce((s, m) => s + m, 0) / durations.length)
        : 0
  }

  return buckets
}

/** Peak hour for longest average sessions */
export function peakSessionHour(buckets: HourBucket[]): HourBucket | null {
  const active = buckets.filter((b) => b.sessionCount >= 2)
  if (active.length === 0) return null
  return active.reduce((best, b) => (b.avgSessionMinutes > best.avgSessionMinutes ? b : best))
}

/** Peak hour for most pauses */
export function peakPauseHour(buckets: PauseHourBucket[]): PauseHourBucket | null {
  const active = buckets.filter((b) => b.pauseCount > 0)
  if (active.length === 0) return null
  return active.reduce((best, b) => (b.pauseCount > best.pauseCount ? b : best))
}

/** Recent sessions sorted by end time (newest first) */
export function recentSessions(entries: TimeEntry[], limit = 8): TimeEntry[] {
  return [...entries]
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, limit)
}

export { addDays }
