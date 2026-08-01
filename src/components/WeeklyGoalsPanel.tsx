import type { Store } from '../hooks/useStore'
import { addDays, formatLongDate, startOfWeekMonday, todayDateKey } from '../utils/time'
import { HudPanel } from './HudPanel'

export function WeeklyGoalsPanel({ store }: { store: Store }) {
  const today = todayDateKey()
  const thisWeek = startOfWeekMonday(today)
  const goals = store.state.weeklyGoals.filter((g) => g.text.trim())
  const weekStart = store.state.weeklyGoalsWeekStart
  const isCurrent =
    weekStart === thisWeek || weekStart === addDays(thisWeek, 7) || weekStart === addDays(thisWeek, -7)

  if (goals.length === 0) {
    return (
      <HudPanel label="WEEKLY GOALS">
        <p className="weekly-goals-empty">
          No goals loaded. Set them in Autopilot → Sunday Center.
        </p>
      </HudPanel>
    )
  }

  return (
    <HudPanel
      label="WEEKLY GOALS"
      action={
        <span className="weekly-goals-when">
          {weekStart ? formatLongDate(weekStart) : ''}
          {!isCurrent ? ' · prior' : ''}
        </span>
      }
    >
      <ol className="weekly-goals-list">
        {goals.map((g, i) => (
          <li key={g.id} className="weekly-goals-item">
            <span className="weekly-goals-index">{i + 1}</span>
            <span className="weekly-goals-text">{g.text}</span>
          </li>
        ))}
      </ol>
      {store.state.weekIntention.trim() && (
        <div className="weekly-goals-focus">
          <span className="field-label">Focus</span>
          <p>{store.state.weekIntention}</p>
        </div>
      )}
    </HudPanel>
  )
}
