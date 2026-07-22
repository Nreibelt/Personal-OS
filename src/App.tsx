import { useState } from 'react'
import { AttentionAllocation } from './components/AttentionAllocation'
import { DailyNotes } from './components/DailyNotes'
import { DailyOneThing, DeepWorkTarget } from './components/DeepWorkTarget'
import { IdentityPanel } from './components/IdentityPanel'
import { MentalRam } from './components/MentalRam'
import { MonthlyCalendar } from './components/MonthlyCalendar'
import { NonNegotiables } from './components/NonNegotiables'
import { ProjectCard } from './components/ProjectCard'
import { ThreeDayCalendar } from './components/ThreeDayCalendar'
import { TimeSummary } from './components/TimeSummary'
import { StartSessionModal, TimerOverlay } from './components/TimerViews'
import { WeekIntention } from './components/WeekIntention'
import { WeekSelector } from './components/WeekSelector'
import { useStore } from './hooks/useStore'
import type { ProjectId } from './types'
import { formatLongDate, formatMinutes } from './utils/time'

type CalView = 'ops' | 'month'

export default function App() {
  const store = useStore()
  const [sessionProject, setSessionProject] = useState<ProjectId | null>(null)
  const [timerMinimized, setTimerMinimized] = useState(false)
  const [calView, setCalView] = useState<CalView>('ops')

  const deepToday = store.deepWorkMinutesForDate(store.state.selectedDate)
  const targetHit = store.hitTarget(store.state.selectedDate)
  const allTime = store.minutesFor('all', 'total')

  return (
    <div className="app-shell">
      <header className="command-bar">
        <div className="brand-lockup">
          <span className="brand-name">BATCAVE</span>
          <span className="brand-sub">Deep Work</span>
        </div>
        <div className="status-pills">
          <span className="status-pill">
            {formatLongDate(store.state.selectedDate)}
          </span>
          <span className={`status-pill ${targetHit ? 'hit' : 'miss'}`}>
            DEEP <strong>{formatMinutes(deepToday)}</strong>
            <span style={{ opacity: 0.7 }}>
              {' '}
              / {formatMinutes(store.state.dailyDeepWorkTargetMinutes)}
            </span>
          </span>
          <span className="status-pill">
            STREAK <strong>{store.targetStreak}</strong>
          </span>
          <span className="status-pill">
            TOTAL <strong>{formatMinutes(allTime)}</strong>
          </span>
          {store.state.activeTimer && <span className="status-pill live">● LIVE</span>}
          <button className="ghost-btn" type="button" onClick={() => store.resetToSeed()}>
            Reset
          </button>
        </div>
      </header>

      <div className="layout-stack">
        <IdentityPanel store={store} />
        <WeekSelector store={store} />

        <div className="target-row">
          <DeepWorkTarget store={store} />
          <DailyOneThing store={store} />
        </div>

        <div className="grid-3">
          <WeekIntention store={store} />
          <MentalRam store={store} />
          <DailyNotes store={store} />
        </div>

        <div className="tasks-toolbar">
          <h2>PROJECTS</h2>
          <button
            type="button"
            className={`ghost-btn${store.state.showAllTasks ? ' active' : ''}`}
            onClick={() => store.setShowAllTasks(!store.state.showAllTasks)}
          >
            {store.state.showAllTasks ? 'Showing all tasks' : 'Show all tasks'}
          </button>
        </div>

        <div className="grid-4">
          {store.projects.map((p) => (
            <ProjectCard
              key={p.id}
              store={store}
              project={p}
              onStart={() => {
                if (store.state.activeTimer?.projectId === p.id) {
                  setTimerMinimized(false)
                  return
                }
                setSessionProject(p.id)
              }}
            />
          ))}
        </div>

        <NonNegotiables store={store} />

        <div className="grid-2">
          <TimeSummary store={store} />
          <AttentionAllocation store={store} />
        </div>

        <div>
          <div className="nav-tabs" role="tablist" aria-label="Calendar view">
            <button
              type="button"
              className={`nav-tab${calView === 'ops' ? ' active' : ''}`}
              onClick={() => setCalView('ops')}
            >
              3-Day
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
            <ThreeDayCalendar store={store} />
          ) : (
            <MonthlyCalendar store={store} />
          )}
        </div>
      </div>

      {sessionProject && (
        <StartSessionModal
          store={store}
          projectId={sessionProject}
          onClose={() => {
            setSessionProject(null)
            setTimerMinimized(false)
          }}
        />
      )}

      {store.state.activeTimer && (
        <TimerOverlay
          store={store}
          minimized={timerMinimized}
          onMinimize={() => setTimerMinimized(true)}
          onExpand={() => setTimerMinimized(false)}
        />
      )}
    </div>
  )
}
