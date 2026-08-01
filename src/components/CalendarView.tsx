import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { DailyOneThing, DeepWorkTarget } from './DeepWorkTarget'
import { MonthlyCalendar } from './MonthlyCalendar'
import { ScheduleCalendar } from './ScheduleCalendar'
import { WeekSelector } from './WeekSelector'

type CalView = 'ops' | 'month'

export function CalendarView({ store }: { store: Store }) {
  const [calView, setCalView] = useState<CalView>('ops')

  return (
    <div className="layout-stack calendar-stage">
      <div className="deep-focus-strip">
        <WeekSelector store={store} />
        <div className="target-row">
          <DeepWorkTarget store={store} />
          <DailyOneThing store={store} />
        </div>
      </div>

      <div>
        <div className="nav-tabs" role="tablist" aria-label="Calendar view">
          <button
            type="button"
            className={`nav-tab${calView === 'ops' ? ' active' : ''}`}
            onClick={() => setCalView('ops')}
          >
            Schedule
          </button>
          <button
            type="button"
            className={`nav-tab${calView === 'month' ? ' active' : ''}`}
            onClick={() => setCalView('month')}
          >
            Month
          </button>
        </div>
        {calView === 'ops' ? (
          <ScheduleCalendar store={store} bodyHeight={780} />
        ) : (
          <MonthlyCalendar
            store={store}
            onOpenDay={(date) => {
              store.setSelectedDate(date)
              setCalView('ops')
            }}
          />
        )}
      </div>
    </div>
  )
}
