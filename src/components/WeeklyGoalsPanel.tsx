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
  const oneThing = (store.state.dailyOneThing[today] || '').trim()
  const visionById = new Map(store.state.visionGoals.map((v) => [v.id, v]))
  const hasVision = store.state.visionGoals.some((v) => v.title.trim())
  const unlinked = goals.filter((g) => !g.visionGoalId || !visionById.has(g.visionGoalId))
  const driftFlags: string[] = []
  if (goals.length > 0 && !oneThing) {
    driftFlags.push('No One Thing for today — week goals have nothing to land on.')
  }
  if (hasVision && goals.length > 0 && unlinked.length === goals.length) {
    driftFlags.push('Weekly goals are unlinked from Vision — horizon cascade is broken.')
  }

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
      label="HORIZON CASCADE"
      action={
        <span className="weekly-goals-when">
          {weekStart ? formatLongDate(weekStart) : ''}
          {!isCurrent ? ' · prior' : ''}
        </span>
      }
    >
      <ol className="weekly-goals-list">
        {goals.map((g, i) => {
          const vision = g.visionGoalId ? visionById.get(g.visionGoalId) : null
          return (
            <li key={g.id} className="weekly-goals-item cascade">
              <span className="weekly-goals-index">{i + 1}</span>
              <div className="weekly-goals-cascade-body">
                {vision && (
                  <span className="weekly-goals-vision">Vision · {vision.title}</span>
                )}
                <span className="weekly-goals-text">{g.text}</span>
                {!vision && hasVision && (
                  <span className="weekly-goals-unlink">Unlinked from Vision</span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {store.state.weekIntention.trim() && (
        <div className="weekly-goals-focus">
          <span className="field-label">Focus</span>
          <p>{store.state.weekIntention}</p>
        </div>
      )}
      <div className="weekly-goals-focus">
        <span className="field-label">Today&apos;s One Thing</span>
        <p className={oneThing ? '' : 'drift'}>
          {oneThing || 'Unset — pick the single outcome that serves the cascade.'}
        </p>
      </div>
      {driftFlags.length > 0 && (
        <ul className="horizon-drift-flags">
          {driftFlags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      )}
    </HudPanel>
  )
}
