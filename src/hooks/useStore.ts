import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSeedState, PROJECTS, uid } from '../data/seed'
import type {
  ActiveTimer,
  AppState,
  AppTab,
  CalendarBlock,
  CashAllocationLine,
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
import {
  addDays,
  parseDateKey,
  startOfWeekMonday,
  toDateKey,
  todayDateKey,
  todayMonthKey,
  weekDays,
} from '../utils/time'

const STORAGE_KEY = 'batcave-deep-work-os-v2'
const FINANCE_BACKUP_KEY = 'batcave-finance-backup-v1'

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

function loadState(): AppState {
  const seed = createSeedState()
  const today = todayDateKey()
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY)
    const rawV1 = localStorage.getItem('batcave-deep-work-os-v1')
    const raw = rawV2 ?? rawV1
    if (!raw) return seed
    const parsed = JSON.parse(raw) as Partial<AppState>

    let personalFinance = migrateLedger(parsed.personalFinance, seed.personalFinance)
    let companyFinance = migrateLedger(parsed.companyFinance, seed.companyFinance)

    // Recover wiped set-expenses from older snapshots / finance backup when possible
    if (rawV1 && rawV2) {
      try {
        const older = JSON.parse(rawV1) as Partial<AppState>
        personalFinance = preferRicherLedger(
          personalFinance,
          migrateLedger(older.personalFinance, seed.personalFinance),
        )
        companyFinance = preferRicherLedger(
          companyFinance,
          migrateLedger(older.companyFinance, seed.companyFinance),
        )
      } catch {
        // ignore
      }
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
      personalFinance,
      companyFinance,
      revolutSync: migrateRevolutSync(parsed.revolutSync, seed.revolutSync),
    }
  } catch {
    return seed
  }
}

function ledgerKey(realm: FinanceRealm): 'personalFinance' | 'companyFinance' {
  return realm === 'personal' ? 'personalFinance' : 'companyFinance'
}

export function useStore() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    writeFinanceBackup(state.personalFinance, state.companyFinance)
  }, [state])

  useEffect(() => {
    if (!state.activeTimer) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [state.activeTimer])

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
    update((s) => ({
      ...s,
      activeTimer: {
        projectId,
        startedAt: Date.now(),
        focusNote,
        elapsedBefore: 0,
      } satisfies ActiveTimer,
    }))
  }, [update])

  const finishTimer = useCallback(() => {
    update((s) => {
      if (!s.activeTimer) return s
      const elapsedMs = Date.now() - s.activeTimer.startedAt + s.activeTimer.elapsedBefore
      const minutes = Math.max(1, Math.round(elapsedMs / 60000))
      const entry: TimeEntry = {
        id: uid('te'),
        projectId: s.activeTimer.projectId,
        date: s.selectedDate,
        minutes,
        note: s.activeTimer.focusNote || undefined,
      }
      return { ...s, activeTimer: null, timeEntries: [...s.timeEntries, entry] }
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
    const ok = window.confirm(
      'Reset deep-work data (tasks, timers, habits)?\n\nPersonal and company finances are kept.',
    )
    if (!ok) return
    const seed = createSeedState()
    setState((s) => {
      const next = {
        ...seed,
        personalFinance: s.personalFinance,
        companyFinance: s.companyFinance,
        revolutSync: s.revolutSync,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      writeFinanceBackup(next.personalFinance, next.companyFinance)
      return next
    })
  }, [])

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
        state.selectedDate === date &&
        isDeepWorkId(state.activeTimer.projectId)
      ) {
        total += Math.floor(
          (Date.now() - state.activeTimer.startedAt + state.activeTimer.elapsedBefore) / 60000,
        )
      }
      return total
    },
    [state.timeEntries, state.activeTimer, state.selectedDate, tick],
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
    if (!state.activeTimer) return 0
    return Math.floor((Date.now() - state.activeTimer.startedAt + state.activeTimer.elapsedBefore) / 1000)
  }, [state.activeTimer, tick])

  const projectMinutesToday = useMemo(() => {
    const map = Object.fromEntries(PROJECTS.map((p) => [p.id, 0])) as Record<ProjectId, number>
    for (const e of state.timeEntries) {
      if (e.date === state.selectedDate) map[e.projectId] += e.minutes
    }
    if (state.activeTimer) {
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
    projects: PROJECTS,
    liveTimerSeconds,
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
    finishTimer,
    discardTimer,
    addCalendarBlock,
    updateCalendarBlock,
    removeCalendarBlock,
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
    minutesFor,
    resetToSeed,
    parseDateKey,
    toDateKey,
  }
}

export type Store = ReturnType<typeof useStore>
