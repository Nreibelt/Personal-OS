import { PROJECTS, PROJECT_MAP } from '../data/seed'
import type { ProjectId } from '../types'
import type { Store } from '../hooks/useStore'
import { blocksOnDate } from '../utils/recurrence'
import {
  formatMinutes,
  formatMonthYear,
  monthGrid,
  shiftMonth,
  todayDateKey,
  todayMonthKey,
} from '../utils/time'
import { HudPanel } from './HudPanel'

const MAX_CHIPS = 3

export function MonthlyCalendar({
  store,
  onOpenDay,
}: {
  store: Store
  onOpenDay?: (date: string) => void
}) {
  const cells = monthGrid(store.state.calendarMonth)
  const dows = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const today = todayDateKey()

  const minutesByDayProject = (date: string) => {
    const map: Partial<Record<ProjectId, number>> = {}
    let total = 0
    for (const e of store.state.timeEntries) {
      if (e.date !== date) continue
      map[e.projectId] = (map[e.projectId] || 0) + e.minutes
      total += e.minutes
    }
    return { map, total }
  }

  return (
    <HudPanel
      label="MONTH"
      action={
        <div className="month-nav">
          <button
            className="ghost-btn"
            type="button"
            aria-label="Previous month"
            onClick={() => store.setCalendarMonth(shiftMonth(store.state.calendarMonth, -1))}
          >
            ‹
          </button>
          <span className="title">{formatMonthYear(store.state.calendarMonth)}</span>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => store.setCalendarMonth(todayMonthKey())}
          >
            Today
          </button>
          <button
            className="ghost-btn"
            type="button"
            aria-label="Next month"
            onClick={() => store.setCalendarMonth(shiftMonth(store.state.calendarMonth, 1))}
          >
            ›
          </button>
        </div>
      }
    >
      <div className="cal-grid">
        {dows.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} className="cal-cell empty" />
          const { map, total } = minutesByDayProject(date)
          const dayBlocks = blocksOnDate(store.state.calendarBlocks, date)
          const selected = date === store.state.selectedDate
          const isToday = date === today
          const hit = store.hitTarget(date)
          return (
            <button
              key={date}
              type="button"
              className={`cal-cell${selected ? ' selected' : ''}${isToday ? ' is-today' : ''}${hit && total > 0 ? ' target-hit' : ''}`}
              onClick={() => store.setSelectedDate(date)}
              onDoubleClick={() => onOpenDay?.(date)}
            >
              <div className="cal-cell-top">
                <span className="cal-daynum">{Number(date.slice(-2))}</span>
                {total > 0 && <span className="cal-total">{formatMinutes(total)}</span>}
              </div>
              {total > 0 && (
                <div className="cal-segments">
                  {PROJECTS.filter((p) => (map[p.id] || 0) > 0).map((p) => (
                    <i
                      key={p.id}
                      style={{
                        width: `${((map[p.id] || 0) / total) * 100}%`,
                        background: p.color,
                      }}
                    />
                  ))}
                </div>
              )}
              {dayBlocks.length > 0 && (
                <div className="cal-events">
                  {dayBlocks.slice(0, MAX_CHIPS).map((b) => {
                    const color = b.projectId ? PROJECT_MAP[b.projectId].color : '#c9b896'
                    return (
                      <span key={b.id} className="cal-event-chip">
                        <i style={{ background: color }} />
                        {b.title}
                      </span>
                    )
                  })}
                  {dayBlocks.length > MAX_CHIPS && (
                    <span className="cal-more">+{dayBlocks.length - MAX_CHIPS} more</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="legend">
        {PROJECTS.map((p) => (
          <span key={p.id}>
            <i style={{ background: PROJECT_MAP[p.id].color }} />
            {p.name}
          </span>
        ))}
      </div>
      {onOpenDay && (
        <p className="sched-hint">CLICK a day to select · DOUBLE-CLICK to open it in the schedule</p>
      )}
    </HudPanel>
  )
}
