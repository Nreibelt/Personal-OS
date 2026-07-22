import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSeedState, PROJECTS, uid } from '../data/seed'
import type {
  ActiveTimer,
  AppState,
  CalendarBlock,
  Habit,
  OpenLoop,
  ProjectId,
  SummaryMode,
  Task,
  TimeEntry,
} from '../types'
import { DEEP_WORK_IDS } from '../types'
import { addDays, parseDateKey, startOfWeekMonday, toDateKey, weekDays } from '../utils/time'

const STORAGE_KEY = 'batcave-deep-work-os-v2'

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

function loadState(): AppState {
  const seed = createSeedState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('batcave-deep-work-os-v1')
    if (!raw) return seed
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      ...seed,
      ...parsed,
      tasks: migrateTasks((parsed.tasks as AppState['tasks']) || seed.tasks),
      dailyDeepWorkTargetMinutes:
        parsed.dailyDeepWorkTargetMinutes ?? seed.dailyDeepWorkTargetMinutes,
      showAllTasks: parsed.showAllTasks ?? false,
      dailyOneThing: { ...seed.dailyOneThing, ...(parsed.dailyOneThing || {}) },
    }
  } catch {
    return seed
  }
}

export function useStore() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!state.activeTimer) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [state.activeTimer])

  const update = useCallback((patch: Partial<AppState> | ((s: AppState) => AppState)) => {
    setState((s) => (typeof patch === 'function' ? patch(s) : { ...s, ...patch }))
  }, [])

  const setSelectedDate = useCallback((date: string) => update({ selectedDate: date }), [update])

  const setIdentity = useCallback(
    (fields: Partial<Pick<AppState, 'identityTitle' | 'identityQuestion' | 'identityBody'>>) =>
      update(fields),
    [update],
  )

  const setWeekIntention = useCallback((weekIntention: string) => update({ weekIntention }), [update])

  const setDailyTargetHours = useCallback((hours: number) => {
    const clamped = Math.max(0.5, Math.min(16, hours))
    update({ dailyDeepWorkTargetMinutes: Math.round(clamped * 60) })
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

  const toggleHabit = useCallback((id: string) => {
    update((s) => ({
      ...s,
      habits: s.habits.map((h) => {
        if (h.id !== id) return h
        const done = !h.done
        return {
          ...h,
          done,
          streak: done ? Math.max(1, h.streak) : h.streak,
        } satisfies Habit
      }),
    }))
  }, [update])

  const addHabit = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    update((s) => ({
      ...s,
      habits: [...s.habits, { id: uid('habit'), name: trimmed, done: false, streak: 0 }],
    }))
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

  const resetToSeed = useCallback(() => {
    const seed = createSeedState()
    setState(seed)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
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
      let total = state.timeEntries
        .filter((e) => e.date === date && DEEP_WORK_IDS.includes(e.projectId))
        .reduce((s, e) => s + e.minutes, 0)
      if (
        state.activeTimer &&
        state.selectedDate === date &&
        DEEP_WORK_IDS.includes(state.activeTimer.projectId)
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
    // Count consecutive hit days ending at selectedDate (walking backward)
    let streak = 0
    let cursor = state.selectedDate
    // If today hasn't hit yet, still count prior streak from yesterday
    if (!hitTarget(cursor)) {
      cursor = addDays(cursor, -1)
    }
    for (let i = 0; i < 365; i++) {
      const mins = state.timeEntries
        .filter((e) => e.date === cursor && DEEP_WORK_IDS.includes(e.projectId))
        .reduce((s, e) => s + e.minutes, 0)
      // Only count days that have some logged deep work OR are hits
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
    setIdentity,
    setWeekIntention,
    setDailyTargetHours,
    setShowAllTasks,
    setOneThing,
    toggleLoop,
    addLoop,
    removeLoop,
    addReminder,
    removeReminder,
    toggleHabit,
    addHabit,
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
    minutesFor,
    resetToSeed,
    parseDateKey,
    toDateKey,
  }
}

export type Store = ReturnType<typeof useStore>
