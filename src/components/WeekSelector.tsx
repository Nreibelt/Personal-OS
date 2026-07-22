import type { Store } from '../hooks/useStore'
import { formatDayLabel, weekDays } from '../utils/time'

export function WeekSelector({ store }: { store: Store }) {
  const days = weekDays(store.state.selectedDate)

  return (
    <div className="week-bar" role="tablist" aria-label="Select day">
      {days.map((key) => {
        const { dow, day } = formatDayLabel(key)
        const active = key === store.state.selectedDate
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
          </button>
        )
      })}
    </div>
  )
}
