import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import type { ProjectId } from '../types'
import { AttentionAllocation } from './AttentionAllocation'
import { DailyNotes } from './DailyNotes'
import { DailyOneThing, DeepWorkTarget } from './DeepWorkTarget'
import { IdentityPanel } from './IdentityPanel'
import { MentalRam } from './MentalRam'
import { MonthlyCalendar } from './MonthlyCalendar'
import { NonNegotiables } from './NonNegotiables'
import { ProjectCard } from './ProjectCard'
import { ThreeDayCalendar } from './ThreeDayCalendar'
import { TimeSummary } from './TimeSummary'
import { StartSessionModal, TimerOverlay } from './TimerViews'
import { WeekIntention } from './WeekIntention'
import { WeekSelector } from './WeekSelector'

type CalView = 'ops' | 'month'

export function DeepWorkView({ store }: { store: Store }) {
  const [sessionProject, setSessionProject] = useState<ProjectId | null>(null)
  const [timerMinimized, setTimerMinimized] = useState(false)
  const [calView, setCalView] = useState<CalView>('ops')

  return (
    <>
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
    </>
  )
}
