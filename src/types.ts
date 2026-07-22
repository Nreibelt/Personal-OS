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
  /** Show backlog tasks across project cards */
  showAllTasks: boolean
  /** Date → most important outcome for that day */
  dailyOneThing: DailyOneThing
}

export type SummaryMode = AppState['summaryMode']

/** Projects that count toward deep work target */
export const DEEP_WORK_IDS: ProjectId[] = ['chase', 'myProject', 'rav']
