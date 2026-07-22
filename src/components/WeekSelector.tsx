import type { Store } from '../hooks/useStore'
import { formatDayLabel, weekDays } from '../utils/time'

export function WeekSelector({ store }: { store: Store }) {
  const days = weekDays(store.state.selectedDate)

  return (
    <div className="week-bar" role="tablist" aria-label="Select day">
      {days.map((key) => {
        const { dow, day } = formatDayLabel(key)
        const active = key === store.state.selectedDate
        const hasData = store.state.timeEntries.some((e) => e.date === key)
        const hit = store.hitTarget(key)
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`day-chip${active ? ' active' : ''}`}
            onClick={() => store.setSelectedDate(key)}
          >
            <span>{dow}</span>
            <span className="num">{day}</span>
            {(hasData || key === store.state.selectedDate) && (
              <span className={`hit-dot ${hit ? 'yes' : 'no'}`} title={hit ? 'Target hit' : 'Below target'} />
            )}
          </button>
        )
      })}
    </div>
  )
}
