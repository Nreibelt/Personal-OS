import type { Project, Task } from '../types'
import type { Store } from '../hooks/useStore'

export function TaskRow({
  task,
  project,
  store,
  showScope,
}: {
  task: Task
  project: Project
  store: Store
  showScope: boolean
}) {
  return (
    <li className="check-item">
      <button
        type="button"
        className={`check-box${task.done ? ' on' : ''}`}
        style={{ borderColor: task.done ? project.color : undefined }}
        onClick={() => store.toggleTask(project.id, task.id)}
      >
        {task.done ? '✓' : ''}
      </button>
      <span className={`check-text${task.done ? ' done' : ''}`}>{task.text}</span>
      {showScope && (
        <button
          type="button"
          className={`scope-toggle ${task.forToday ? 'today' : 'future'}`}
          onClick={() => store.setTaskForToday(project.id, task.id, !task.forToday)}
          title={task.forToday ? 'Scheduled today — click for backlog' : 'Backlog — click for today'}
        >
          {task.forToday ? 'Today' : 'Later'}
        </button>
      )}
      <button
        type="button"
        className="x-btn"
        onClick={() => store.removeTask(project.id, task.id)}
      >
        ×
      </button>
    </li>
  )
}
