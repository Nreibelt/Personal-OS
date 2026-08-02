import type { SessionFeeling, SessionTag, TimeEntry } from '../types'
import { SESSION_FEELINGS } from '../types'
import { hourInAppTz } from './sessionAnalytics'

export interface FeelingCount {
  feeling: SessionFeeling
  label: string
  count: number
  pct: number
}

export interface FeelingHourBucket {
  hour: number
  label: string
  total: number
  weapon: number
  solid: number
  meh: number
  dragged: number
  dominant: SessionFeeling | null
}

export interface FeelingDurationBucket {
  label: string
  min: number
  max: number
  count: number
  weaponPct: number
  draggedPct: number
  dominant: SessionFeeling | null
}

export interface TagCount {
  tag: SessionTag
  count: number
}

function hourLabel(h: number): string {
  if (h === 0) return '12a'
  if (h < 12) return `${h}a`
  if (h === 12) return '12p'
  return `${h - 12}p`
}

function dominantFeeling(counts: Record<SessionFeeling, number>): SessionFeeling | null {
  let best: SessionFeeling | null = null
  let n = 0
  for (const f of SESSION_FEELINGS) {
    if (counts[f.id] > n) {
      n = counts[f.id]
      best = f.id
    }
  }
  return n > 0 ? best : null
}

export function entriesWithDebrief(entries: TimeEntry[]): TimeEntry[] {
  return entries.filter((e) => e.debrief)
}

export function computeFeelingCounts(entries: TimeEntry[]): FeelingCount[] {
  const withD = entriesWithDebrief(entries)
  const total = withD.length || 1
  return SESSION_FEELINGS.map((f) => {
    const count = withD.filter((e) => e.debrief!.feeling === f.id).length
    return {
      feeling: f.id,
      label: f.label,
      count,
      pct: Math.round((count / total) * 100),
    }
  })
}

export function aggregateFeelingByHour(entries: TimeEntry[]): FeelingHourBucket[] {
  const buckets: FeelingHourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    total: 0,
    weapon: 0,
    solid: 0,
    meh: 0,
    dragged: 0,
    dominant: null,
  }))

  for (const e of entriesWithDebrief(entries)) {
    if (e.startedAt == null || !e.debrief) continue
    const h = hourInAppTz(e.startedAt)
    const b = buckets[h]
    b.total += 1
    b[e.debrief.feeling] += 1
  }

  for (const b of buckets) {
    b.dominant = dominantFeeling({
      weapon: b.weapon,
      solid: b.solid,
      meh: b.meh,
      dragged: b.dragged,
    })
  }
  return buckets
}

const DURATION_BUCKETS = [
  { label: '<45m', min: 0, max: 45 },
  { label: '45–90m', min: 45, max: 90 },
  { label: '90m+', min: 90, max: Infinity },
]

export function aggregateFeelingByDuration(entries: TimeEntry[]): FeelingDurationBucket[] {
  return DURATION_BUCKETS.map((bucket) => {
    const list = entriesWithDebrief(entries).filter(
      (e) => e.minutes >= bucket.min && e.minutes < bucket.max,
    )
    const counts = { weapon: 0, solid: 0, meh: 0, dragged: 0 }
    for (const e of list) counts[e.debrief!.feeling] += 1
    const n = list.length || 1
    return {
      label: bucket.label,
      min: bucket.min,
      max: bucket.max,
      count: list.length,
      weaponPct: Math.round((counts.weapon / n) * 100),
      draggedPct: Math.round((counts.dragged / n) * 100),
      dominant: dominantFeeling(counts),
    }
  })
}

export function computeTagCounts(entries: TimeEntry[]): TagCount[] {
  const map = new Map<SessionTag, number>()
  for (const e of entriesWithDebrief(entries)) {
    for (const tag of e.debrief!.tags) {
      map.set(tag, (map.get(tag) || 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}
