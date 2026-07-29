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
import { ScheduleCalendar } from './ScheduleCalendar'
import { TimeSummary } from './TimeSummary'
import { SessionAnalytics, PauseAnalytics } from './SessionAnalytics'
import { WeekIntention } from './WeekIntention'
import { WeekSelector } from './WeekSelector'
import { Modal } from './ui/Modal'

type CalView = 'ops' | 'month'
type DeepModal = 'identity' | 'mental' | 'habits' | 'analytics' | null

export function DeepWorkView({
  store,
  onStartSession,
}: {
  store: Store
  onStartSession: (projectId: ProjectId) => void
}) {
  const [calView, setCalView] = useState<CalView>('ops')
  const [modal, setModal] = useState<DeepModal>(null)

  return (
    <>
      <div className="layout-stack deep-work-clean">
        <div className="deep-focus-strip">
          <WeekSelector store={store} />
          <div className="target-row">
            <DeepWorkTarget store={store} />
            <DailyOneThing store={store} />
          </div>
        </div>

        <section className="action-board compact">
          <header className="action-board-head">
            <h2 className="action-board-title">Command surfaces</h2>
            <p className="action-board-copy">Identity, mental RAM, habits, and analytics stay out of the way.</p>
          </header>
          <div className="action-board-grid four">
            <button type="button" className="action-tile compact" onClick={() => setModal('identity')}>
              <span className="action-tile-kicker">90-day</span>
              <span className="action-tile-name">Identity</span>
            </button>
            <button type="button" className="action-tile compact" onClick={() => setModal('mental')}>
              <span className="action-tile-kicker">Mind</span>
              <span className="action-tile-name">Intention & loops</span>
            </button>
            <button type="button" className="action-tile compact" onClick={() => setModal('habits')}>
              <span className="action-tile-kicker">Rituals</span>
              <span className="action-tile-name">Non-negotiables</span>
            </button>
            <button type="button" className="action-tile compact" onClick={() => setModal('analytics')}>
              <span className="action-tile-kicker">Readouts</span>
              <span className="action-tile-name">Time analytics</span>
            </button>
          </div>
        </section>

        <div className="tasks-toolbar">
          <h2>Projects</h2>
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
              onStart={() => onStartSession(p.id)}
            />
          ))}
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
            <ScheduleCalendar store={store} />
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

      <Modal open={modal === 'identity'} onClose={() => setModal(null)} title="90-day identity" size="lg">
        <IdentityPanel store={store} />
      </Modal>

      <Modal open={modal === 'mental'} onClose={() => setModal(null)} title="Mental OS" size="lg">
        <div className="layout-stack">
          <WeekIntention store={store} />
          <MentalRam store={store} />
          <DailyNotes store={store} />
        </div>
      </Modal>

      <Modal open={modal === 'habits'} onClose={() => setModal(null)} title="Non-negotiables" size="md">
        <NonNegotiables store={store} />
      </Modal>

      <Modal open={modal === 'analytics'} onClose={() => setModal(null)} title="Time analytics" size="xl">
        <div className="analytics-stack">
          <div className="grid-2">
            <TimeSummary store={store} />
            <AttentionAllocation store={store} />
          </div>
          <div className="grid-2">
            <SessionAnalytics store={store} />
            <PauseAnalytics store={store} />
          </div>
        </div>
      </Modal>
    </>
  )
}
