import type { BlockRepeat, CalendarBlock } from '../types'
import { parseDateKey } from './time'

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD key. */
export function dayOfWeek(key: string): number {
  return parseDateKey(key).getDay()
}

/** Does this block (one-off or repeating series) land on `date`? */
export function blockOccursOn(block: CalendarBlock, date: string): boolean {
  if (!block.repeat) return block.date === date
  if (date < block.date) return false
  if (block.repeat.until && date > block.repeat.until) return false
  if (block.skipDates?.includes(date)) return false
  return block.repeat.days.includes(dayOfWeek(date))
}

/** All blocks that occur on `date`, sorted by start time. */
export function blocksOnDate(blocks: CalendarBlock[], date: string): CalendarBlock[] {
  return blocks
    .filter((b) => blockOccursOn(b, date))
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS = [1, 2, 3, 4, 5]

/** Human label for a repeat rule: "Daily", "Weekdays", "Mon · Wed · Fri" … */
export function describeRepeat(repeat: BlockRepeat | undefined): string {
  if (!repeat || repeat.days.length === 0) return 'Does not repeat'
  const days = [...new Set(repeat.days)].sort((a, b) => a - b)
  let label: string
  if (days.length === 7) {
    label = 'Daily'
  } else if (days.length === 5 && WEEKDAYS.every((d) => days.includes(d))) {
    label = 'Weekdays'
  } else if (days.length === 2 && days.includes(0) && days.includes(6)) {
    label = 'Weekends'
  } else {
    label = days.map((d) => DOW_SHORT[d]).join(' · ')
  }
  if (repeat.until) label += ` until ${repeat.until}`
  return label
}

/**
 * Lay out one day's blocks so overlapping events sit side by side.
 * Returns column index + total columns of the overlap cluster for each block.
 */
export function layoutDayBlocks(
  blocks: CalendarBlock[],
  live?: { id: string; start: number; end: number } | null,
): Map<string, { col: number; cols: number }> {
  const items = blocks
    .map((b) => ({
      id: b.id,
      start: live?.id === b.id ? live.start : b.startMinutes,
      end: live?.id === b.id ? live.end : b.endMinutes,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const result = new Map<string, { col: number; cols: number }>()
  let cluster: typeof items = []
  let clusterEnd = -1
  let columns: number[] = [] // end time per column within the cluster

  const flush = () => {
    for (const item of cluster) {
      const entry = result.get(item.id)
      if (entry) entry.cols = columns.length
    }
    cluster = []
    columns = []
  }

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    let col = columns.findIndex((end) => end <= item.start)
    if (col === -1) {
      col = columns.length
      columns.push(item.end)
    } else {
      columns[col] = item.end
    }
    result.set(item.id, { col, cols: 1 })
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return result
}
