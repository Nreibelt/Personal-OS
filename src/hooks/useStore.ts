import { useAuth, useSession } from '@clerk/nextjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSeedState, PROJECTS, uid } from '../data/seed'
import {
  createClerkSupabaseClient,
  isSupabaseConfigured,
} from '../lib/supabase/browser'
import {
  applyRevolutCredentialsToBrowser,
  isThinCloudPayload,
  mergeRevolutCredentials,
  preferRicherState,
  withLocalRevolutCredentials,
} from '../lib/supabase/sync'
import type {
  ActiveTimer,
  AppState,
  AppTab,
  CalendarBlock,
  CashAllocationLine,
  CompanyIdea,
  DailyDeepWorkSplit,
  DeepWorkId,
  ExpenseCategory,
  ExpenseFrequency,
  FinanceLedger,
  FinanceRealm,
  Habit,
  OpenLoop,
  ProjectId,
  RevolutReviewItem,
  RevolutSyncState,
  SpendEntry,
  SummaryMode,
  Task,
  TimeEntry,
} from '../types'
import {
  DEEP_WORK_IDS,
  equalDeepWorkSplit,
  isDeepWorkId,
  scaleDeepWorkSplit,
} from '../types'
import { mergePersonalFoodAndDrink } from '../utils/finance'
import {
  addDays,
  parseDateKey,
  startOfWeekMonday,
  toDateKey,
  todayDateKey,
  todayMonthKey,
  weekDays,
} from '../utils/time'
import {
  aggregatePausesByHour,
  aggregateSessionsByHour,
  computeDurationBuckets,
  computePauseStats,
  computeSessionStats,
  filterEntriesByScope,
  peakPauseHour,
  peakSessionHour,
  recentSessions,
} from '../utils/sessionAnalytics'
import { revolutCredentialsChangedEvent } from '../utils/revolutApi'

const STORAGE_KEY = 'batcave-deep-work-os-v2'
const FINANCE_BACKUP_KEY = 'batcave-finance-backup-v1'

/** Active work ms for a timer — excludes pause time. */
function activeTimerWorkMs(t: ActiveTimer, now = Date.now()): number {
  if (t.pausedAt) return t.elapsedBefore
  return now - t.startedAt + t.elapsedBefore
}

function migrateActiveTimer(raw: unknown): ActiveTimer | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Partial<ActiveTimer>
  if (!t.projectId || typeof t.startedAt !== 'number') return null
  const sessionStartedAt =
    typeof t.sessionStartedAt === 'number' ? t.sessionStartedAt : t.startedAt
  return {
    projectId: t.projectId,
    startedAt: t.startedAt,
    sessionStartedAt,
    focusNote: typeof t.focusNote === 'string' ? t.focusNote : '',
    elapsedBefore: typeof t.elapsedBefore === 'number' ? t.elapsedBefore : 0,
    pausedBefore: typeof t.pausedBefore === 'number' ? t.pausedBefore : 0,
    pausedAt: typeof t.pausedAt === 'number' ? t.pausedAt : undefined,
    pauseCount: typeof t.pauseCount === 'number' ? t.pauseCount : 0,
    pauses: Array.isArray(t.pauses) ? t.pauses : [],
  }
}

function migrateTimeEntry(raw: unknown): TimeEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Partial<TimeEntry>
  if (!e.id || !e.projectId || !e.date || typeof e.minutes !== 'number') return null
  const startedAt = typeof e.startedAt === 'number' ? e.startedAt : undefined
  // Timers used to save against the calendar’s selected day. Prefer the Bali
  // wall-clock day of the session so a browse-away doesn’t misfile hours.
  const date =
    startedAt != null ? todayDateKey(new Date(startedAt)) : e.date
  return {
    id: e.id,
    projectId: e.projectId,
    date,
    minutes: e.minutes,
    note: e.note,
    startedAt,
    endedAt: typeof e.endedAt === 'number' ? e.endedAt : undefined,
    pausedMinutes: typeof e.pausedMinutes === 'number' ? e.pausedMinutes : undefined,
    pauseCount: typeof e.pauseCount === 'number' ? e.pauseCount : undefined,
    pauses: Array.isArray(e.pauses) ? e.pauses : undefined,
  }
}

function migrateTimeEntries(raw: unknown, fallback: TimeEntry[]): TimeEntry[] {
  if (!Array.isArray(raw)) return fallback
  return raw.map(migrateTimeEntry).filter((e): e is TimeEntry => e != null)
}

function migrateTasks(tasks: AppState['tasks']): AppState['tasks'] {
  const next = { ...tasks }
  for (const id of Object.keys(next) as ProjectId[]) {
    next[id] = (next[id] || []).map((t) => ({
      ...t,
      forToday: typeof t.forToday === 'boolean' ? t.forToday : true,
    }))
  }
  return next
}

/** Active streak only if last tick was today or yesterday; otherwise broken → 0. */
export function habitDisplayStreak(habit: Habit, today = todayDateKey()): number {
  if (!habit.lastCompletedDate || habit.streak <= 0) return 0
  const yesterday = addDays(today, -1)
  if (habit.lastCompletedDate === today || habit.lastCompletedDate === yesterday) {
    return habit.streak
  }
  return 0
}

export function isHabitDoneOn(habit: Habit, date: string): boolean {
  return habit.lastCompletedDate === date
}

function migrateHabits(raw: unknown, today: string): Habit[] {
  if (!Array.isArray(raw)) return []
  const yesterday = addDays(today, -1)
  return raw.map((item) => {
    const h = item as Partial<Habit> & { done?: boolean }
    const id = typeof h.id === 'string' && h.id ? h.id : uid('habit')
    const name = typeof h.name === 'string' ? h.name : 'Habit'
    let lastCompletedDate: string | null =
      typeof h.lastCompletedDate === 'string' && h.lastCompletedDate
        ? h.lastCompletedDate
        : null
    let streak = Math.max(0, Math.round(Number(h.streak) || 0))

    // Legacy boolean `done` → treat as completed today so it stays locked for the day
    if (!lastCompletedDate && h.done) {
      lastCompletedDate = today
      streak = Math.max(1, streak)
    }

    if (lastCompletedDate && lastCompletedDate !== today && lastCompletedDate !== yesterday) {
      streak = 0
    }

    return { id, name, streak, lastCompletedDate } satisfies Habit
  })
}

function migrateSplit(
  raw: Partial<DailyDeepWorkSplit> | undefined,
  totalMinutes: number,
  fallback: DailyDeepWorkSplit,
): DailyDeepWorkSplit {
  if (!raw || typeof raw !== 'object') {
    return scaleDeepWorkSplit(fallback, totalMinutes)
  }
  const split: DailyDeepWorkSplit = {
    chase: Math.max(0, Math.round(Number(raw.chase) || 0)),
    myProject: Math.max(0, Math.round(Number(raw.myProject) || 0)),
    rav: Math.max(0, Math.round(Number(raw.rav) || 0)),
  }
  const sum = DEEP_WORK_IDS.reduce((s, id) => s + split[id], 0)
  if (sum <= 0) return equalDeepWorkSplit(totalMinutes)
  if (sum !== totalMinutes) return scaleDeepWorkSplit(split, totalMinutes)
  return split
}

function migrateLedger(raw: Partial<FinanceLedger> | undefined, fallback: FinanceLedger): FinanceLedger {
  if (!raw || typeof raw !== 'object') return fallback
  const categories = Array.isArray(raw.categories) ? raw.categories : fallback.categories
  const hasBills = categories.some((c) => c.isPreset && !c.parentId && c.name.toLowerCase() === 'bills')
  return {
    categories: hasBills ? categories : [...fallback.categories, ...categories],
    allocations: Array.isArray(raw.allocations) ? raw.allocations : [],
    spends: Array.isArray(raw.spends) ? raw.spends : [],
  }
}

/** True when the ledger has more than a bare empty Bills preset. */
function isRichLedger(ledger: FinanceLedger): boolean {
  const cats = ledger.categories || []
  if (cats.length === 0) return false
  if (cats.length > 1) return true
  const only = cats[0]
  if (!only) return false
  if (only.name.toLowerCase() !== 'bills') return true
  if (only.amount > 0) return true
  return cats.some((c) => c.parentId)
}

function preferRicherLedger(current: FinanceLedger, candidate: FinanceLedger): FinanceLedger {
  if (!isRichLedger(current) && isRichLedger(candidate)) return candidate
  if (candidate.categories.length > current.categories.length) return candidate
  return current
}

function readFinanceBackup(): {
  personalFinance?: FinanceLedger
  companyFinance?: FinanceLedger
} | null {
  try {
    const raw = localStorage.getItem(FINANCE_BACKUP_KEY)
    if (!raw) return null
    return JSON.parse(raw) as {
      personalFinance?: FinanceLedger
      companyFinance?: FinanceLedger
    }
  } catch {
    return null
  }
}

function writeFinanceBackup(personal: FinanceLedger, company: FinanceLedger) {
  if (!isRichLedger(personal) && !isRichLedger(company)) return
  try {
    localStorage.setItem(
      FINANCE_BACKUP_KEY,
      JSON.stringify({
        personalFinance: personal,
        companyFinance: company,
        savedAt: Date.now(),
      }),
    )
  } catch {
    // ignore quota errors
  }
}

function migrateRevolutSync(
  raw: Partial<RevolutSyncState> | undefined,
  fallback: RevolutSyncState,
): RevolutSyncState {
  if (!raw || typeof raw !== 'object') return fallback
  return {
    personalAccountIds: Array.isArray(raw.personalAccountIds) ? raw.personalAccountIds : [],
    companyAccountIds: Array.isArray(raw.companyAccountIds) ? raw.companyAccountIds : [],
    personalQueue: Array.isArray(raw.personalQueue) ? raw.personalQueue : [],
    companyQueue: Array.isArray(raw.companyQueue) ? raw.companyQueue : [],
    // Drop legacy discard settlements — discarded txns should reappear on sync
    settledIds: [],
  }
}

function queueKey(realm: FinanceRealm): 'personalQueue' | 'companyQueue' {
  return realm === 'personal' ? 'personalQueue' : 'companyQueue'
}

function accountIdsKey(realm: FinanceRealm): 'personalAccountIds' | 'companyAccountIds' {
  return realm === 'personal' ? 'personalAccountIds' : 'companyAccountIds'
}

function normalizeAppState(parsed: Partial<AppState>, options?: { recoverLocal?: boolean }): AppState {
  const seed = createSeedState()
  const today = todayDateKey()

  let personalFinance = migrateLedger(parsed.personalFinance, seed.personalFinance)
  let companyFinance = migrateLedger(parsed.companyFinance, seed.companyFinance)

  if (options?.recoverLocal) {
    try {
      const rawV1 = localStorage.getItem('batcave-deep-work-os-v1')
      const rawV2 = localStorage.getItem(STORAGE_KEY)
      if (rawV1 && rawV2) {
        const older = JSON.parse(rawV1) as Partial<AppState>
        personalFinance = preferRicherLedger(
          personalFinance,
          migrateLedger(older.personalFinance, seed.personalFinance),
        )
        companyFinance = preferRicherLedger(
          companyFinance,
          migrateLedger(older.companyFinance, seed.companyFinance),
        )
      }
    } catch {
      // ignore
    }
    const backup = readFinanceBackup()
    if (backup) {
      personalFinance = preferRicherLedger(
        personalFinance,
        migrateLedger(backup.personalFinance, seed.personalFinance),
      )
      companyFinance = preferRicherLedger(
        companyFinance,
        migrateLedger(backup.companyFinance, seed.companyFinance),
      )
    }
  }

  return {
    ...seed,
    ...parsed,
    // Always open on Bali “today” so the day label matches WITA
    selectedDate: today,
    calendarMonth: todayMonthKey(),
    activeTab: parsed.activeTab ?? 'dashboard',
    tasks: migrateTasks((parsed.tasks as AppState['tasks']) || seed.tasks),
    dailyDeepWorkTargetMinutes:
      parsed.dailyDeepWorkTargetMinutes ?? seed.dailyDeepWorkTargetMinutes,
    dailyDeepWorkSplit: migrateSplit(
      parsed.dailyDeepWorkSplit,
      parsed.dailyDeepWorkTargetMinutes ?? seed.dailyDeepWorkTargetMinutes,
      seed.dailyDeepWorkSplit,
    ),
    showAllTasks: parsed.showAllTasks ?? false,
    dailyOneThing: { ...seed.dailyOneThing, ...(parsed.dailyOneThing || {}) },
    habits: migrateHabits(parsed.habits ?? seed.habits, today),
    personalFinance: mergePersonalFoodAndDrink(personalFinance),
    companyFinance,
    revolutSync: migrateRevolutSync(parsed.revolutSync, seed.revolutSync),
    revolutCredentials: parsed.revolutCredentials,
    companyDocuments: Array.isArray(parsed.companyDocuments)
      ? parsed.companyDocuments
      : seed.companyDocuments,
    companyIdeas: Array.isArray(parsed.companyIdeas)
      ? parsed.companyIdeas.map((idea) => {
          const raw = idea as CompanyIdea & { title?: string }
          const text = typeof raw.text === 'string' ? raw.text : ''
          const title =
            typeof raw.title === 'string' && raw.title.trim()
              ? raw.title.trim()
              : text.split('\n')[0]?.slice(0, 80) || 'Untitled idea'
          return {
            id: raw.id,
            title,
            text,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
          }
        })
      : seed.companyIdeas,
    timeEntries: migrateTimeEntries(parsed.timeEntries, seed.timeEntries),
    activeTimer: migrateActiveTimer(parsed.activeTimer),
  }
}

function loadState(): AppState {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY)
    const rawV1 = localStorage.getItem('batcave-deep-work-os-v1')
    const raw = rawV2 ?? rawV1
    if (!raw) return createSeedState()
    return normalizeAppState(JSON.parse(raw) as Partial<AppState>, { recoverLocal: true })
  } catch {
    return createSeedState()
  }
}

function ledgerKey(realm: FinanceRealm): 'personalFinance' | 'companyFinance' {
  return realm === 'personal' ? 'personalFinance' : 'companyFinance'
}

export function useStore() {
  const { isLoaded: authLoaded, userId } = useAuth()
  const { session } = useSession()
  const [state, setState] = useState<AppState>(() => loadState())
  const [tick, setTick] = useState(0)
  const [cloudSync, setCloudSync] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [cloudSource, setCloudSource] = useState<'local' | 'remote' | null>(null)
  const skipNextCloudSave = useRef(false)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    writeFinanceBackup(state.personalFinance, state.companyFinance)
  }, [state])

  const upsertCloudState = useCallback(
    async (next: AppState) => {
      if (!userId || !session) throw new Error('Not signed in')
      const client = createClerkSupabaseClient(() => session.getToken())
      if (!client) throw new Error('Supabase is not configured')
      const payload = withLocalRevolutCredentials(next)
      const { error } = await client.from('user_app_state').upsert({
        user_id: userId,
        state: payload,
        updated_at: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      return payload
    },
    [userId, session],
  )

  // Load / seed cloud document once Clerk + Supabase are ready
  useEffect(() => {
    if (!authLoaded || !userId || !session) return
    if (!isSupabaseConfigured()) {
      setCloudSync('idle')
      return
    }

    let cancelled = false
    setCloudSync('loading')
    setCloudError(null)

    ;(async () => {
      try {
        const client = createClerkSupabaseClient(() => session.getToken())
        if (!client) {
          setCloudSync('idle')
          return
        }

        const local = withLocalRevolutCredentials(loadState())
        const { data, error } = await client
          .from('user_app_state')
          .select('state, updated_at')
          .eq('user_id', userId)
          .maybeSingle()

        if (cancelled) return

        if (error) {
          setCloudError(error.message)
          setCloudSync('error')
          return
        }

        let chosen = local
        let source: 'local' | 'remote' = 'local'

        if (data?.state && typeof data.state === 'object' && !isThinCloudPayload(data.state)) {
          const remote = normalizeAppState(data.state as Partial<AppState>, {
            recoverLocal: true,
          })
          remote.revolutCredentials = mergeRevolutCredentials(
            remote.revolutCredentials,
            local.revolutCredentials,
          )
          const pick = preferRicherState(local, withLocalRevolutCredentials(remote))
          chosen = pick.winner
          source = pick.source
        }

        // Always persist the chosen snapshot so browser data lands under this Clerk user
        const saved = await upsertCloudState(chosen)
        if (cancelled) return

        applyRevolutCredentialsToBrowser(saved.revolutCredentials)
        skipNextCloudSave.current = true
        setState(saved)
        setCloudSource(source)
        setCloudSync('ready')
      } catch (err) {
        if (cancelled) return
        setCloudError(err instanceof Error ? err.message : 'Cloud sync failed')
        setCloudSync('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoaded, userId, session, upsertCloudState])

  // Debounced cloud save after hydration
  useEffect(() => {
    if (cloudSync !== 'ready' || !userId || !session) return
    if (!isSupabaseConfigured()) return
    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false
      return
    }

    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void upsertCloudState(state)
        .then((saved) => {
          if (saved.revolutCredentials !== state.revolutCredentials) {
            skipNextCloudSave.current = true
            setState(saved)
          }
        })
        .catch((err) => {
          setCloudError(err instanceof Error ? err.message : 'Cloud save failed')
        })
    }, 800)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [state, cloudSync, userId, session, upsertCloudState])

  const pushBrowserToCloud = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setCloudError('Supabase env vars are missing')
      setCloudSync('error')
      return
    }
    try {
      setCloudSync('loading')
      const local = withLocalRevolutCredentials(loadState())
      // Prefer in-memory state (includes unsaved edits) over a fresh localStorage read
      const merged = preferRicherState(
        withLocalRevolutCredentials(state),
        local,
      ).winner
      const saved = await upsertCloudState(merged)
      applyRevolutCredentialsToBrowser(saved.revolutCredentials)
      skipNextCloudSave.current = true
      setState(saved)
      setCloudSource('local')
      setCloudError(null)
      setCloudSync('ready')
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Upload failed')
      setCloudSync('error')
    }
  }, [state, upsertCloudState])

  useEffect(() => {
    if (!state.activeTimer) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [state.activeTimer])

  // Keep Revolut secrets inside AppState so they ride along with cloud upserts
  useEffect(() => {
    const onChange = () => {
      setState((s) => withLocalRevolutCredentials(s))
    }
    window.addEventListener(revolutCredentialsChangedEvent(), onChange)
    return () => window.removeEventListener(revolutCredentialsChangedEvent(), onChange)
  }, [])

  const update = useCallback((patch: Partial<AppState> | ((s: AppState) => AppState)) => {
    setState((s) => (typeof patch === 'function' ? patch(s) : { ...s, ...patch }))
  }, [])

  const patchLedger = useCallback(
    (realm: FinanceRealm, fn: (ledger: FinanceLedger) => FinanceLedger) => {
      const key = ledgerKey(realm)
      update((s) => ({ ...s, [key]: fn(s[key]) }))
    },
    [update],
  )

  const setSelectedDate = useCallback((date: string) => update({ selectedDate: date }), [update])
  const setActiveTab = useCallback((activeTab: AppTab) => update({ activeTab }), [update])

  const setIdentity = useCallback(
    (fields: Partial<Pick<AppState, 'identityTitle' | 'identityQuestion' | 'identityBody'>>) =>
      update(fields),
    [update],
  )

  const setWeekIntention = useCallback((weekIntention: string) => update({ weekIntention }), [update])

  const setDailyTargetHours = useCallback((hours: number) => {
    const clamped = Math.max(0.5, Math.min(16, hours))
    const minutes = Math.round(clamped * 60)
    update((s) => ({
      ...s,
      dailyDeepWorkTargetMinutes: minutes,
      dailyDeepWorkSplit: scaleDeepWorkSplit(s.dailyDeepWorkSplit, minutes),
    }))
  }, [update])

  /** Set the full allocation from hours per section. Split sum becomes the new total. */
  const setDailyDeepWorkSplit = useCallback((splitHours: Record<DeepWorkId, number>) => {
    const split: DailyDeepWorkSplit = {
      chase: Math.max(0, Math.round(splitHours.chase * 60)),
      myProject: Math.max(0, Math.round(splitHours.myProject * 60)),
      rav: Math.max(0, Math.round(splitHours.rav * 60)),
    }
    let total = DEEP_WORK_IDS.reduce((s, id) => s + split[id], 0)
    total = Math.max(30, Math.min(16 * 60, total))
    const normalized =
      DEEP_WORK_IDS.reduce((s, id) => s + split[id], 0) === total
        ? split
        : scaleDeepWorkSplit(split, total)
    update({
      dailyDeepWorkTargetMinutes: total,
      dailyDeepWorkSplit: normalized,
    })
  }, [update])

  const setShowAllTasks = useCallback((showAllTasks: boolean) => update({ showAllTasks }), [update])

  const setOneThing = useCallback((date: string, text: string) => {
    update((s) => ({
      ...s,
      dailyOneThing: { ...s.dailyOneThing, [date]: text },
    }))
  }, [update])

  const toggleLoop = useCallback((id: string) => {
    update((s) => ({
      ...s,
      openLoops: s.openLoops.map((l) => (l.id === id ? { ...l, done: !l.done } : l)),
    }))
  }, [update])

  const addLoop = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    update((s) => ({
      ...s,
      openLoops: [...s.openLoops, { id: uid('loop'), text: trimmed, done: false } satisfies OpenLoop],
    }))
  }, [update])

  const removeLoop = useCallback((id: string) => {
    update((s) => ({ ...s, openLoops: s.openLoops.filter((l) => l.id !== id) }))
  }, [update])

  const addReminder = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    update((s) => ({ ...s, reminders: [...s.reminders, trimmed] }))
  }, [update])

  const removeReminder = useCallback((index: number) => {
    update((s) => ({ ...s, reminders: s.reminders.filter((_, i) => i !== index) }))
  }, [update])

  /** Tick a non-negotiable for Bali today — locks for the day and advances the streak. */
  const completeHabit = useCallback((id: string) => {
    const today = todayDateKey()
    const yesterday = addDays(today, -1)
    update((s) => ({
      ...s,
      habits: s.habits.map((h) => {
        if (h.id !== id) return h
        if (h.lastCompletedDate === today) return h
        const continued = h.lastCompletedDate === yesterday
        const prior = continued ? habitDisplayStreak(h, today) : 0
        return {
          ...h,
          lastCompletedDate: today,
          streak: prior + 1,
        } satisfies Habit
      }),
    }))
  }, [update])

  const addHabit = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    update((s) => ({
      ...s,
      habits: [
        ...s.habits,
        { id: uid('habit'), name: trimmed, streak: 0, lastCompletedDate: null },
      ],
    }))
  }, [update])

  const removeHabit = useCallback((id: string) => {
    update((s) => ({ ...s, habits: s.habits.filter((h) => h.id !== id) }))
  }, [update])

  const toggleTask = useCallback((projectId: ProjectId, taskId: string) => {
    update((s) => ({
      ...s,
      tasks: {
        ...s.tasks,
        [projectId]: s.tasks[projectId].map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t,
        ),
      },
    }))
  }, [update])

  const setTaskForToday = useCallback((projectId: ProjectId, taskId: string, forToday: boolean) => {
    update((s) => ({
      ...s,
      tasks: {
        ...s.tasks,
        [projectId]: s.tasks[projectId].map((t) =>
          t.id === taskId ? { ...t, forToday } : t,
        ),
      },
    }))
  }, [update])

  const addTask = useCallback((projectId: ProjectId, text: string, forToday = true) => {
    const trimmed = text.trim()
    if (!trimmed) return
    update((s) => ({
      ...s,
      tasks: {
        ...s.tasks,
        [projectId]: [
          ...s.tasks[projectId],
          { id: uid('task'), text: trimmed, done: false, forToday } satisfies Task,
        ],
      },
    }))
  }, [update])

  const removeTask = useCallback((projectId: ProjectId, taskId: string) => {
    update((s) => ({
      ...s,
      tasks: {
        ...s.tasks,
        [projectId]: s.tasks[projectId].filter((t) => t.id !== taskId),
      },
    }))
  }, [update])

  const setSummaryMode = useCallback((summaryMode: SummaryMode) => update({ summaryMode }), [update])
  const setCalendarMonth = useCallback((calendarMonth: string) => update({ calendarMonth }), [update])

  const startTimer = useCallback((projectId: ProjectId, focusNote: string) => {
    const now = Date.now()
    update((s) => ({
      ...s,
      activeTimer: {
        projectId,
        startedAt: now,
        sessionStartedAt: now,
        focusNote,
        elapsedBefore: 0,
        pausedBefore: 0,
        pauseCount: 0,
        pauses: [],
      } satisfies ActiveTimer,
    }))
  }, [update])

  const pauseTimer = useCallback(() => {
    update((s) => {
      const t = s.activeTimer
      if (!t || t.pausedAt) return s
      const now = Date.now()
      return {
        ...s,
        activeTimer: {
          ...t,
          elapsedBefore: t.elapsedBefore + (now - t.startedAt),
          pausedAt: now,
          pauseCount: t.pauseCount + 1,
        },
      }
    })
  }, [update])

  const resumeTimer = useCallback(() => {
    update((s) => {
      const t = s.activeTimer
      if (!t || !t.pausedAt) return s
      const now = Date.now()
      const pauseDuration = now - t.pausedAt
      return {
        ...s,
        activeTimer: {
          ...t,
          startedAt: now,
          pausedAt: undefined,
          pausedBefore: t.pausedBefore + pauseDuration,
          pauses: [...t.pauses, { startedAt: t.pausedAt, durationMs: pauseDuration }],
        },
      }
    })
  }, [update])

  const finishTimer = useCallback(() => {
    update((s) => {
      if (!s.activeTimer) return s
      const t = s.activeTimer
      const now = Date.now()

      let pauses = [...t.pauses]
      let pausedBefore = t.pausedBefore
      if (t.pausedAt) {
        const durationMs = now - t.pausedAt
        pauses.push({ startedAt: t.pausedAt, durationMs })
        pausedBefore += durationMs
      }

      const activeMs = activeTimerWorkMs(t, now)
      const minutes = Math.max(1, Math.round(activeMs / 60000))
      const pausedMinutes = Math.round(pausedBefore / 60000)
      const sessionDate = todayDateKey(new Date(t.sessionStartedAt))

      const entry: TimeEntry = {
        id: uid('te'),
        projectId: t.projectId,
        date: sessionDate,
        minutes,
        note: t.focusNote || undefined,
        startedAt: t.sessionStartedAt,
        endedAt: now,
        pausedMinutes: pausedMinutes > 0 ? pausedMinutes : undefined,
        pauseCount: t.pauseCount > 0 ? t.pauseCount : undefined,
        pauses: pauses.length > 0 ? pauses : undefined,
      }
      return {
        ...s,
        selectedDate: sessionDate,
        activeTimer: null,
        timeEntries: [...s.timeEntries, entry],
      }
    })
  }, [update])

  const discardTimer = useCallback(() => {
    update({ activeTimer: null })
  }, [update])

  const addCalendarBlock = useCallback((block: Omit<CalendarBlock, 'id'>) => {
    update((s) => ({
      ...s,
      calendarBlocks: [...s.calendarBlocks, { ...block, id: uid('block') }],
    }))
  }, [update])

  const updateCalendarBlock = useCallback((id: string, patch: Partial<CalendarBlock>) => {
    update((s) => ({
      ...s,
      calendarBlocks: s.calendarBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
  }, [update])

  const removeCalendarBlock = useCallback((id: string) => {
    update((s) => ({
      ...s,
      calendarBlocks: s.calendarBlocks.filter((b) => b.id !== id),
    }))
  }, [update])

  /** Hide a single occurrence of a repeating block (delete "this event only"). */
  const skipBlockOccurrence = useCallback((id: string, date: string) => {
    update((s) => ({
      ...s,
      calendarBlocks: s.calendarBlocks.map((b) =>
        b.id === id
          ? { ...b, skipDates: [...new Set([...(b.skipDates || []), date])] }
          : b,
      ),
    }))
  }, [update])

  /**
   * Edit a single occurrence of a repeating block: the occurrence is removed
   * from the series and re-created as a standalone block with `patch` applied.
   */
  const detachBlockOccurrence = useCallback(
    (id: string, date: string, patch: Partial<Omit<CalendarBlock, 'id'>>) => {
      update((s) => {
        const source = s.calendarBlocks.find((b) => b.id === id)
        if (!source) return s
        const detached: CalendarBlock = {
          ...source,
          ...patch,
          id: uid('block'),
          date: patch.date ?? date,
          repeat: undefined,
          skipDates: undefined,
        }
        return {
          ...s,
          calendarBlocks: [
            ...s.calendarBlocks.map((b) =>
              b.id === id
                ? { ...b, skipDates: [...new Set([...(b.skipDates || []), date])] }
                : b,
            ),
            detached,
          ],
        }
      })
    },
    [update],
  )

  // ——— Finance ———

  const addExpenseCategory = useCallback(
    (
      realm: FinanceRealm,
      input: { name: string; frequency: ExpenseFrequency; amount: number; parentId?: string },
    ) => {
      const name = input.name.trim()
      if (!name || input.amount < 0) return
      patchLedger(realm, (ledger) => {
        const parent = input.parentId
          ? ledger.categories.find((c) => c.id === input.parentId)
          : undefined
        const cat: ExpenseCategory = {
          id: uid('cat'),
          name,
          frequency: parent?.frequency ?? input.frequency,
          amount: Math.round(input.amount * 100) / 100,
          parentId: input.parentId,
        }
        return { ...ledger, categories: [...ledger.categories, cat] }
      })
    },
    [patchLedger],
  )

  const updateExpenseCategory = useCallback(
    (
      realm: FinanceRealm,
      id: string,
      patch: Partial<Pick<ExpenseCategory, 'name' | 'frequency' | 'amount'>>,
    ) => {
      patchLedger(realm, (ledger) => ({
        ...ledger,
        categories: ledger.categories.map((c) => {
          if (c.id !== id) {
            // When parent frequency changes, sync children
            if (
              patch.frequency &&
              c.parentId === id
            ) {
              return { ...c, frequency: patch.frequency }
            }
            return c
          }
          const next = { ...c, ...patch }
          if (typeof patch.amount === 'number') {
            next.amount = Math.round(patch.amount * 100) / 100
          }
          if (patch.name !== undefined) next.name = patch.name.trim() || c.name
          return next
        }),
      }))
    },
    [patchLedger],
  )

  const removeExpenseCategory = useCallback(
    (realm: FinanceRealm, id: string) => {
      patchLedger(realm, (ledger) => {
        const target = ledger.categories.find((c) => c.id === id)
        if (!target || target.isPreset) return ledger
        const removeIds = new Set([
          id,
          ...ledger.categories.filter((c) => c.parentId === id).map((c) => c.id),
        ])
        return {
          ...ledger,
          categories: ledger.categories.filter((c) => !removeIds.has(c.id)),
        }
      })
    },
    [patchLedger],
  )

  const addCashAllocation = useCallback(
    (
      realm: FinanceRealm,
      input: {
        date: string
        totalAmount: number
        note?: string
        lines: Omit<CashAllocationLine, 'id'>[]
      },
    ) => {
      if (input.totalAmount <= 0 || input.lines.length === 0) return
      const lines: CashAllocationLine[] = input.lines
        .filter((l) => l.amount > 0)
        .map((l) => ({ ...l, id: uid('aline'), amount: Math.round(l.amount * 100) / 100 }))
      if (lines.length === 0) return
      patchLedger(realm, (ledger) => ({
        ...ledger,
        allocations: [
          {
            id: uid('alloc'),
            date: input.date,
            totalAmount: Math.round(input.totalAmount * 100) / 100,
            note: input.note?.trim() || undefined,
            lines,
          },
          ...ledger.allocations,
        ],
      }))
    },
    [patchLedger],
  )

  const removeCashAllocation = useCallback(
    (realm: FinanceRealm, id: string) => {
      patchLedger(realm, (ledger) => ({
        ...ledger,
        allocations: ledger.allocations.filter((a) => a.id !== id),
      }))
    },
    [patchLedger],
  )

  const addSpend = useCallback(
    (
      realm: FinanceRealm,
      input: {
        date: string
        amount: number
        kind: SpendEntry['kind']
        categoryId?: string
        label?: string
        note?: string
        revolutId?: string
      },
    ) => {
      if (input.amount <= 0) return
      if (input.kind === 'category' && !input.categoryId) return
      if (input.kind === 'unexpected' && !input.label?.trim()) return
      const entry: SpendEntry = {
        id: uid('spend'),
        date: input.date,
        amount: Math.round(input.amount * 100) / 100,
        kind: input.kind,
        categoryId: input.categoryId,
        label: input.label?.trim() || undefined,
        note: input.note?.trim() || undefined,
        revolutId: input.revolutId,
      }
      patchLedger(realm, (ledger) => ({
        ...ledger,
        spends: [entry, ...ledger.spends],
      }))
    },
    [patchLedger],
  )

  const removeSpend = useCallback(
    (realm: FinanceRealm, id: string) => {
      patchLedger(realm, (ledger) => ({
        ...ledger,
        spends: ledger.spends.filter((s) => s.id !== id),
      }))
    },
    [patchLedger],
  )

  const setRevolutAccountIds = useCallback(
    (realm: FinanceRealm, accountIds: string[]) => {
      const key = accountIdsKey(realm)
      update((s) => ({
        ...s,
        revolutSync: {
          ...s.revolutSync,
          [key]: [...new Set(accountIds)],
        },
      }))
    },
    [update],
  )

  const mergeRevolutReviewItems = useCallback(
    (realm: FinanceRealm, items: RevolutReviewItem[]) => {
      const qKey = queueKey(realm)
      update((s) => {
        // Only skip txns already logged as spends — discarded ones come back on re-sync
        const logged = new Set<string>()
        for (const spend of s.personalFinance.spends) {
          if (spend.revolutId) logged.add(spend.revolutId)
        }
        for (const spend of s.companyFinance.spends) {
          if (spend.revolutId) logged.add(spend.revolutId)
        }
        const existing = new Map(s.revolutSync[qKey].map((item) => [item.id, item]))
        for (const item of items) {
          if (logged.has(item.id)) continue
          existing.set(item.id, item)
        }
        return {
          ...s,
          revolutSync: {
            ...s.revolutSync,
            settledIds: [],
            [qKey]: [...existing.values()].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            ),
          },
        }
      })
    },
    [update],
  )

  const discardRevolutReviewItem = useCallback(
    (realm: FinanceRealm, id: string) => {
      const qKey = queueKey(realm)
      update((s) => ({
        ...s,
        revolutSync: {
          ...s.revolutSync,
          // Remove from queue only — do not permanently settle (re-sync can show again)
          [qKey]: s.revolutSync[qKey].filter((item) => item.id !== id),
        },
      }))
    },
    [update],
  )

  const categorizeRevolutReviewItem = useCallback(
    (
      realm: FinanceRealm,
      id: string,
      input: {
        kind: SpendEntry['kind']
        categoryId?: string
        label?: string
      },
    ) => {
      if (input.kind === 'category' && !input.categoryId) return
      if (input.kind === 'unexpected' && !input.label?.trim()) return

      const qKey = queueKey(realm)
      const ledger = ledgerKey(realm)

      update((s) => {
        const item = s.revolutSync[qKey].find((row) => row.id === id)
        if (!item || item.direction !== 'out' || item.amount <= 0) return s

        const entry: SpendEntry = {
          id: uid('spend'),
          date: item.date,
          amount: Math.round(item.amount * 100) / 100,
          kind: input.kind,
          categoryId: input.categoryId,
          label: input.label?.trim() || undefined,
          note: [item.merchant, item.description].filter(Boolean).join(' · ') || undefined,
          revolutId: item.id,
        }

        return {
          ...s,
          [ledger]: {
            ...s[ledger],
            spends: [entry, ...s[ledger].spends],
          },
          revolutSync: {
            ...s.revolutSync,
            [qKey]: s.revolutSync[qKey].filter((row) => row.id !== id),
          },
        }
      })
    },
    [update],
  )

  const resetToSeed = useCallback(() => {
    const seed = createSeedState()
    setState((s) => {
      const next = {
        ...seed,
        personalFinance: s.personalFinance,
        companyFinance: s.companyFinance,
        revolutSync: s.revolutSync,
        companyDocuments: s.companyDocuments,
        companyIdeas: s.companyIdeas,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      writeFinanceBackup(next.personalFinance, next.companyFinance)
      return next
    })
  }, [])

  const addCompanyDocument = useCallback(
    (input: { title: string; content?: string; sourceName?: string }) => {
      const now = new Date().toISOString()
      const title = input.title.trim() || 'Untitled'
      const id = uid('doc')
      update((s) => ({
        ...s,
        companyDocuments: [
          {
            id,
            title,
            content: input.content ?? '',
            sourceName: input.sourceName,
            createdAt: now,
            updatedAt: now,
          },
          ...s.companyDocuments,
        ],
      }))
      return id
    },
    [update],
  )

  const updateCompanyDocument = useCallback(
    (id: string, patch: Partial<{ title: string; content: string }>) => {
      const now = new Date().toISOString()
      update((s) => ({
        ...s,
        companyDocuments: s.companyDocuments.map((d) =>
          d.id === id
            ? {
                ...d,
                title: patch.title !== undefined ? patch.title.trim() || d.title : d.title,
                content: patch.content !== undefined ? patch.content : d.content,
                updatedAt: now,
              }
            : d,
        ),
      }))
    },
    [update],
  )

  const removeCompanyDocument = useCallback(
    (id: string) => {
      update((s) => ({
        ...s,
        companyDocuments: s.companyDocuments.filter((d) => d.id !== id),
      }))
    },
    [update],
  )

  const addCompanyIdea = useCallback(
    (input: { title: string; text: string }) => {
      const title = input.title.trim()
      const text = input.text.trim()
      if (!title && !text) return
      const now = new Date().toISOString()
      update((s) => ({
        ...s,
        companyIdeas: [
          {
            id: uid('idea'),
            title: title || 'Untitled idea',
            text,
            createdAt: now,
            updatedAt: now,
          },
          ...s.companyIdeas,
        ],
      }))
    },
    [update],
  )

  const updateCompanyIdea = useCallback(
    (id: string, patch: Partial<{ title: string; text: string }>) => {
      const now = new Date().toISOString()
      update((s) => ({
        ...s,
        companyIdeas: s.companyIdeas.map((idea) => {
          if (idea.id !== id) return idea
          const title =
            patch.title !== undefined ? patch.title.trim() || idea.title : idea.title
          const text = patch.text !== undefined ? patch.text : idea.text
          return { ...idea, title, text, updatedAt: now }
        }),
      }))
    },
    [update],
  )

  const removeCompanyIdea = useCallback(
    (id: string) => {
      update((s) => ({
        ...s,
        companyIdeas: s.companyIdeas.filter((idea) => idea.id !== id),
      }))
    },
    [update],
  )

  const minutesFor = useCallback(
    (projectId: ProjectId | 'all', scope: 'day' | 'week' | 'total', date = state.selectedDate) => {
      let entries = state.timeEntries
      if (scope === 'day') {
        entries = entries.filter((e) => e.date === date)
      } else if (scope === 'week') {
        const days = new Set(weekDays(date))
        entries = entries.filter((e) => days.has(e.date))
      }
      if (projectId !== 'all') entries = entries.filter((e) => e.projectId === projectId)
      return entries.reduce((sum, e) => sum + e.minutes, 0)
    },
    [state.timeEntries, state.selectedDate],
  )

  const deepWorkMinutesForDate = useCallback(
    (date: string) => {
      void tick
      let total = state.timeEntries
        .filter((e) => e.date === date && isDeepWorkId(e.projectId))
        .reduce((s, e) => s + e.minutes, 0)
      if (
        state.activeTimer &&
        isDeepWorkId(state.activeTimer.projectId) &&
        todayDateKey(new Date(state.activeTimer.sessionStartedAt)) === date
      ) {
        total += Math.floor(activeTimerWorkMs(state.activeTimer) / 60000)
      }
      return total
    },
    [state.timeEntries, state.activeTimer, tick],
  )

  const hitTarget = useCallback(
    (date: string) => deepWorkMinutesForDate(date) >= state.dailyDeepWorkTargetMinutes,
    [deepWorkMinutesForDate, state.dailyDeepWorkTargetMinutes],
  )

  const targetStreak = useMemo(() => {
    let streak = 0
    let cursor = state.selectedDate
    if (!hitTarget(cursor)) {
      cursor = addDays(cursor, -1)
    }
    for (let i = 0; i < 365; i++) {
      const mins = state.timeEntries
        .filter((e) => e.date === cursor && isDeepWorkId(e.projectId))
        .reduce((s, e) => s + e.minutes, 0)
      const hasData = state.timeEntries.some((e) => e.date === cursor)
      if (!hasData && mins === 0) break
      if (mins >= state.dailyDeepWorkTargetMinutes) {
        streak += 1
        cursor = addDays(cursor, -1)
      } else {
        break
      }
    }
    return streak
  }, [state.selectedDate, state.timeEntries, state.dailyDeepWorkTargetMinutes, hitTarget])

  const weekHitRate = useMemo(() => {
    const days = weekDays(state.selectedDate)
    let hits = 0
    let counted = 0
    for (const d of days) {
      const hasData = state.timeEntries.some((e) => e.date === d)
      if (!hasData && d > state.selectedDate) continue
      if (!hasData && d !== state.selectedDate) continue
      counted += 1
      if (hitTarget(d)) hits += 1
    }
    return { hits, counted }
  }, [state.selectedDate, state.timeEntries, hitTarget])

  const liveTimerSeconds = useMemo(() => {
    void tick
    const t = state.activeTimer
    if (!t) return 0
    return Math.floor(activeTimerWorkMs(t) / 1000)
  }, [state.activeTimer, tick])

  const livePauseSeconds = useMemo(() => {
    void tick
    const t = state.activeTimer
    if (!t) return 0
    let ms = t.pausedBefore
    if (t.pausedAt) ms += Date.now() - t.pausedAt
    return Math.floor(ms / 1000)
  }, [state.activeTimer, tick])

  const isTimerPaused = !!state.activeTimer?.pausedAt

  const scopedTimeEntries = useMemo(
    () => filterEntriesByScope(state.timeEntries, state.summaryMode, state.selectedDate),
    [state.timeEntries, state.summaryMode, state.selectedDate],
  )

  const sessionStats = useMemo(
    () => computeSessionStats(scopedTimeEntries),
    [scopedTimeEntries],
  )

  const durationBuckets = useMemo(
    () => computeDurationBuckets(scopedTimeEntries),
    [scopedTimeEntries],
  )

  const sessionsByHour = useMemo(
    () => aggregateSessionsByHour(scopedTimeEntries),
    [scopedTimeEntries],
  )

  const peakSession = useMemo(() => peakSessionHour(sessionsByHour), [sessionsByHour])

  const pauseStats = useMemo(() => computePauseStats(scopedTimeEntries), [scopedTimeEntries])

  const pausesByHour = useMemo(
    () => aggregatePausesByHour(scopedTimeEntries),
    [scopedTimeEntries],
  )

  const peakPause = useMemo(() => peakPauseHour(pausesByHour), [pausesByHour])

  const recentSessionEntries = useMemo(
    () => recentSessions(scopedTimeEntries),
    [scopedTimeEntries],
  )

  const projectMinutesToday = useMemo(() => {
    const map = Object.fromEntries(PROJECTS.map((p) => [p.id, 0])) as Record<ProjectId, number>
    for (const e of state.timeEntries) {
      if (e.date === state.selectedDate) map[e.projectId] += e.minutes
    }
    if (
      state.activeTimer &&
      todayDateKey(new Date(state.activeTimer.sessionStartedAt)) === state.selectedDate
    ) {
      const liveMin = Math.floor(liveTimerSeconds / 60)
      map[state.activeTimer.projectId] += liveMin
    }
    return map
  }, [state.timeEntries, state.selectedDate, state.activeTimer, liveTimerSeconds])

  const weekStart = startOfWeekMonday(state.selectedDate)
  const weekEnd = addDays(weekStart, 6)

  const financeFor = useCallback(
    (realm: FinanceRealm) => state[ledgerKey(realm)],
    [state],
  )

  return {
    state,
    cloudSync,
    cloudError,
    cloudSource,
    pushBrowserToCloud,
    projects: PROJECTS,
    liveTimerSeconds,
    livePauseSeconds,
    isTimerPaused,
    sessionStats,
    durationBuckets,
    sessionsByHour,
    peakSession,
    pauseStats,
    pausesByHour,
    peakPause,
    recentSessionEntries,
    projectMinutesToday,
    weekStart,
    weekEnd,
    deepWorkMinutesForDate,
    hitTarget,
    targetStreak,
    weekHitRate,
    setSelectedDate,
    setActiveTab,
    setIdentity,
    setWeekIntention,
    setDailyTargetHours,
    setDailyDeepWorkSplit,
    setShowAllTasks,
    setOneThing,
    toggleLoop,
    addLoop,
    removeLoop,
    addReminder,
    removeReminder,
    completeHabit,
    addHabit,
    removeHabit,
    toggleTask,
    setTaskForToday,
    addTask,
    removeTask,
    setSummaryMode,
    setCalendarMonth,
    startTimer,
    pauseTimer,
    resumeTimer,
    finishTimer,
    discardTimer,
    addCalendarBlock,
    updateCalendarBlock,
    removeCalendarBlock,
    skipBlockOccurrence,
    detachBlockOccurrence,
    addExpenseCategory,
    updateExpenseCategory,
    removeExpenseCategory,
    addCashAllocation,
    removeCashAllocation,
    addSpend,
    removeSpend,
    setRevolutAccountIds,
    mergeRevolutReviewItems,
    discardRevolutReviewItem,
    categorizeRevolutReviewItem,
    financeFor,
    addCompanyDocument,
    updateCompanyDocument,
    removeCompanyDocument,
    addCompanyIdea,
    updateCompanyIdea,
    removeCompanyIdea,
    minutesFor,
    resetToSeed,
    parseDateKey,
    toDateKey,
  }
}

export type Store = ReturnType<typeof useStore>
