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
  /** YYYY-MM-DD when this task is planned; null/undefined = undated backlog */
  plannedDate?: string | null
}

export interface Habit {
  id: string
  name: string
  /** Consecutive days completed ending on lastCompletedDate */
  streak: number
  /** YYYY-MM-DD of the last day this was ticked (Bali calendar) */
  lastCompletedDate: string | null
}

export interface OpenLoop {
  id: string
  text: string
  done: boolean
}

/** A single pause segment within a work session */
export interface PauseSegment {
  /** Epoch ms when the pause started */
  startedAt: number
  /** How long the pause lasted in ms */
  durationMs: number
}

export interface TimeEntry {
  id: string
  projectId: ProjectId
  date: string // YYYY-MM-DD
  minutes: number
  note?: string
  /** Epoch ms when the session started (enables duration + time-of-day analytics) */
  startedAt?: number
  /** Epoch ms when the session ended */
  endedAt?: number
  /** Total paused time during this session (minutes) */
  pausedMinutes?: number
  /** Number of pause events in this session */
  pauseCount?: number
  /** Individual pause segments for time-of-day pause trends */
  pauses?: PauseSegment[]
}

/** Recurrence rule for a calendar block. */
export interface BlockRepeat {
  /** Days of week the block repeats on: 0 = Sunday … 6 = Saturday. Daily = all 7. */
  days: number[]
  /** Optional inclusive end date (YYYY-MM-DD). Absent = repeats forever. */
  until?: string
}

export interface CalendarBlock {
  id: string
  title: string
  date: string // YYYY-MM-DD — one-off date, or first day of a repeating series
  startMinutes: number // minutes from midnight
  endMinutes: number
  projectId?: ProjectId
  color?: string
  /** When present the block repeats on these weekdays from `date` onward. */
  repeat?: BlockRepeat
  /** Series dates hidden because that occurrence was deleted or edited individually. */
  skipDates?: string[]
}

export interface ActiveTimer {
  projectId: ProjectId
  /** When the current active segment started (resets on resume) */
  startedAt: number
  /** Original session start — preserved across pauses */
  sessionStartedAt: number
  focusNote: string
  /** Accumulated active (work) ms before the current segment */
  elapsedBefore: number
  /** Accumulated pause ms from completed pauses */
  pausedBefore: number
  /** When the current pause started; undefined while running */
  pausedAt?: number
  /** Number of pause events this session */
  pauseCount: number
  /** Completed pause segments (current pause finalized on resume) */
  pauses: PauseSegment[]
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

/** Top-level product surface */
export type AppTab =
  | 'dashboard'
  | 'calendar'
  | 'tasks'
  | 'personalFinances'
  | 'companyFinances'
  | 'autopilot'

const APP_TABS: readonly AppTab[] = [
  'dashboard',
  'calendar',
  'tasks',
  'personalFinances',
  'companyFinances',
  'autopilot',
]

/** Map persisted / legacy tab ids onto current AppTab values. */
export function normalizeActiveTab(tab: unknown): AppTab {
  if (tab === 'deepWork') return 'calendar'
  if (typeof tab === 'string' && (APP_TABS as readonly string[]).includes(tab)) {
    return tab as AppTab
  }
  return 'dashboard'
}

/** Post-login layer: hub gate, personal OS, or company Batcave */
export type AppLayer = 'gate' | 'personal' | 'business'

/** Tabs inside the Batcave (company) layer */
export type BusinessTab = 'todos' | 'finance' | 'documents' | 'ideas' | 'metaAds' | 'coldEmail' | 'agents'

export type EisenhowerQuadrant = 'do' | 'schedule' | 'delegate' | 'eliminate'
/** @deprecated use EisenhowerQuadrant — kept as alias during migration */
export type CompanyTaskPriority = EisenhowerQuadrant
export type CompanyTaskStatus = 'not_started' | 'in_progress' | 'done'

export interface CompanyTask {
  id: string
  userId: string
  title: string
  priority: EisenhowerQuadrant
  status: CompanyTaskStatus
  notes: string
  parentId: string | null
  /** Manual list order among root tasks (lower = higher) */
  sortOrder: number
  /** When true, the task row is blurred so the title cannot be read */
  hidden: boolean
  createdAt: string
  updatedAt: string
  /** Task IDs that must be done before this one can proceed */
  blockedByIds: string[]
}

export type FinanceRealm = 'personal' | 'company'

export type ExpenseFrequency = 'daily' | 'weekly' | 'monthly'

/** Set-expense category / bucket. Bills is seeded as a preset parent for micro expenses. */
export interface ExpenseCategory {
  id: string
  name: string
  frequency: ExpenseFrequency
  /** Budget for one frequency period. For parents with children, effective budget is sum of children. */
  amount: number
  /** Present when this is a micro-expense under Bills (or another parent). */
  parentId?: string
  /** Seeded presets like Bills cannot be deleted. */
  isPreset?: boolean
}

export interface CashAllocationLine {
  id: string
  kind: 'category' | 'custom'
  categoryId?: string
  customLabel?: string
  amount: number
}

/** Income event: total cash in, split across buckets and/or one-off expenses. */
export interface CashAllocation {
  id: string
  date: string
  totalAmount: number
  note?: string
  lines: CashAllocationLine[]
}

/** Outflow logged against a set expense or as unexpected / ad-hoc spend. */
export interface SpendEntry {
  id: string
  date: string
  amount: number
  kind: 'category' | 'unexpected'
  categoryId?: string
  label?: string
  note?: string
  /** Revolut leg key (`txnId:legId`) when imported from sync */
  revolutId?: string
}

export interface FinanceLedger {
  categories: ExpenseCategory[]
  allocations: CashAllocation[]
  spends: SpendEntry[]
}

/** Pending Revolut row awaiting categorize / discard in a finance realm. */
export interface RevolutReviewItem {
  id: string
  revolutTransactionId: string
  legId: string
  accountId: string
  accountName: string
  date: string
  createdAt: string
  amount: number
  currency: string
  direction: 'in' | 'out'
  type: string
  state: string
  merchant: string
  description: string
  reference?: string
  cardLastFour?: string
}

export interface RevolutSyncState {
  /** Revolut account IDs synced into Personal Finances */
  personalAccountIds: string[]
  /** Revolut account IDs synced into Company Finances */
  companyAccountIds: string[]
  personalQueue: RevolutReviewItem[]
  companyQueue: RevolutReviewItem[]
  /**
   * Legacy field. Discarded txns are no longer stored here — only logged spends
   * (via SpendEntry.revolutId) are skipped on re-sync. Kept empty for older clients.
   */
  settledIds: string[]
}

/** Revolut browser secrets — also persisted in Supabase under the signed-in user. */
export interface RevolutCredentials {
  appSecret: string
  refreshToken: string
}

export interface AppState {
  selectedDate: string
  activeTab: AppTab
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
  personalFinance: FinanceLedger
  companyFinance: FinanceLedger
  revolutSync: RevolutSyncState
  /** Optional — synced to Supabase so Revolut works across browsers for this user */
  revolutCredentials?: RevolutCredentials
  /** Batcave documents (offer docs, briefs, etc.) */
  companyDocuments: CompanyDocument[]
  /** Batcave idea dump */
  companyIdeas: CompanyIdea[]
}

export interface CompanyDocument {
  id: string
  title: string
  /** Rich text body (HTML). Legacy plain/markdown is converted on load. */
  content: string
  /** Optional original filename when uploaded */
  sourceName?: string
  createdAt: string
  updatedAt: string
}

export interface CompanyIdea {
  id: string
  title: string
  text: string
  createdAt: string
  updatedAt: string
}

export type SummaryMode = AppState['summaryMode']
