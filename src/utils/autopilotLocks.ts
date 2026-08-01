import type { AppState } from '../types'
import { addDays, startOfWeekMonday, todayDateKey, upcomingSunday } from './time'

export type AutopilotRoutineId =
  | 'evening'
  | 'saturday-dump'
  | 'sunday-admin'
  | 'sunday-center'

export function isAutopilotLocked(state: AppState, routine: AutopilotRoutineId): boolean {
  const today = todayDateKey()
  const sunday = upcomingSunday(today)
  const completions = state.autopilotCompletions

  if (routine === 'evening') {
    return completions?.eveningWindDownDate === today
  }
  if (routine === 'saturday-dump') {
    return state.lastSaturdayDumpSunday === sunday
  }
  if (routine === 'sunday-admin') {
    return completions?.sundayAdminDate === sunday
  }
  // Sunday Center locks for the week it planned
  const nextWeekStart = addDays(startOfWeekMonday(today), 7)
  return completions?.sundayCenterWeekStart === nextWeekStart
}

export function autopilotLockLabel(routine: AutopilotRoutineId): string {
  if (routine === 'evening') return 'Done today'
  if (routine === 'saturday-dump') return 'Locked · Sunday loaded'
  if (routine === 'sunday-admin') return 'Done this Sunday'
  return 'Done this week'
}
