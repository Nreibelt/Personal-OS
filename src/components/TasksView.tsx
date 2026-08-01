import type { Store } from '../hooks/useStore'
import type { ProjectId } from '../types'
import { DailyOneThing } from './DeepWorkTarget'
import { ProjectCard } from './ProjectCard'
import { WeekSelector } from './WeekSelector'

export function TasksView({
  store,
  onStartSession,
}: {
  store: Store
  onStartSession: (projectId: ProjectId) => void
}) {
  return (
    <div className="layout-stack tasks-stage">
      <div className="deep-focus-strip">
        <WeekSelector store={store} />
        <DailyOneThing store={store} />
      </div>

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

      <div className="grid-projects">
        {store.projects.map((p) => (
          <ProjectCard
            key={p.id}
            store={store}
            project={p}
            onStart={() => onStartSession(p.id)}
          />
        ))}
      </div>
    </div>
  )
}
