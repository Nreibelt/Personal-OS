export type ProjectId = 'chase' | 'myProject' | 'rav' | 'personal'

export interface Project {
  id: ProjectId
  name: string
  color: string
}

export interface Task {
  id: string
  text: string
  done: boolean
  /** Planned for execution today vs backlog brain-dump */
  forToday: boolean
}

export interface Habit {
  id: string
  name: string
  done: boolean
  streak: number
}

export interface OpenLoop {
  id: string
  text: string
  done: boolean
}

export interface TimeEntry {
  id: string
  projectId: ProjectId
  date: string // YYYY-MM-DD
  minutes: number
  note?: string
}

export interface CalendarBlock {
  id: string
  title: string
  date: string // YYYY-MM-DD
  startMinutes: number // minutes from midnight
  endMinutes: number
  projectId?: ProjectId
  color?: string
}

export interface ActiveTimer {
  projectId: ProjectId
  startedAt: number
  focusNote: string
  elapsedBefore: number
}

/** Per-day one-liner: the single outcome that matters */
export type DailyOneThing = Record<string, string>

/** Projects that count toward deep work target */
export const DEEP_WORK_IDS = ['chase', 'myProject', 'rav'] as const

export type DeepWorkId = (typeof DEEP_WORK_IDS)[number]

/** How the daily deep work total is allocated across the three deep-work projects */
export type DailyDeepWorkSplit = Record<DeepWorkId, number>

export function isDeepWorkId(id: ProjectId): id is DeepWorkId {
  return (DEEP_WORK_IDS as readonly ProjectId[]).includes(id)
}

/** Split a total evenly across the three deep-work projects (remainder to chase). */
export function equalDeepWorkSplit(totalMinutes: number): DailyDeepWorkSplit {
  const base = Math.floor(totalMinutes / 3)
  const rem = totalMinutes - base * 3
  return {
    chase: base + rem,
    myProject: base,
    rav: base,
  }
}

/** Scale an existing split so its parts sum to `totalMinutes` (preserves ratios). */
export function scaleDeepWorkSplit(
  split: DailyDeepWorkSplit,
  totalMinutes: number,
): DailyDeepWorkSplit {
  const sum = DEEP_WORK_IDS.reduce((s, id) => s + split[id], 0)
  if (sum <= 0) return equalDeepWorkSplit(totalMinutes)
  const scaled = Object.fromEntries(
    DEEP_WORK_IDS.map((id) => [id, Math.round((split[id] / sum) * totalMinutes)]),
  ) as DailyDeepWorkSplit
  // Fix rounding drift on chase
  const scaledSum = DEEP_WORK_IDS.reduce((s, id) => s + scaled[id], 0)
  scaled.chase += totalMinutes - scaledSum
  return scaled
}

export interface AppState {
  selectedDate: string
  identityTitle: string
  identityQuestion: string
  identityBody: string
  weekIntention: string
  openLoops: OpenLoop[]
  reminders: string[]
  habits: Habit[]
  tasks: Record<ProjectId, Task[]>
  timeEntries: TimeEntry[]
  calendarBlocks: CalendarBlock[]
  activeTimer: ActiveTimer | null
  summaryMode: 'day' | 'week' | 'total'
  calendarMonth: string // YYYY-MM
  /** Daily deep work target in minutes (Chase + My Project + Rav) */
  dailyDeepWorkTargetMinutes: number
  /** Minutes allocated to each deep-work project (should sum to dailyDeepWorkTargetMinutes) */
  dailyDeepWorkSplit: DailyDeepWorkSplit
  /** Show backlog tasks across project cards */
  showAllTasks: boolean
  /** Date → most important outcome for that day */
  dailyOneThing: DailyOneThing
}

export type SummaryMode = AppState['summaryMode']
