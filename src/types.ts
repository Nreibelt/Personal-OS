export type ProjectId = 'chase' | 'myProject' | 'rav' | 'personal'

export interface Project {
  id: ProjectId
  name: string
  color: string
  glow: string
}

export interface Task {
  id: string
  text: string
  done: boolean
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
}

export type SummaryMode = AppState['summaryMode']
