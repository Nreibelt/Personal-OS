import { useState } from 'react'
import type { Project } from '../types'
import type { Store } from '../hooks/useStore'
import { formatMinutes } from '../utils/time'
import { HudPanel } from './HudPanel'

export function ProjectCard({
  store,
  project,
  onStart,
}: {
  store: Store
  project: Project
  onStart: () => void
}) {
  const [taskText, setTaskText] = useState('')
  const minutes = store.projectMinutesToday[project.id]
  const tasks = store.state.tasks[project.id]
  const isLive = store.state.activeTimer?.projectId === project.id

  return (
    <HudPanel className="project-card" style={{ borderColor: `${project.color}33` }}>
      <div className="project-head">
        <span className="dot" style={{ background: project.color, color: project.color }} />
        <h3 className="project-name" style={{ color: project.color }}>
          {project.name}
        </h3>
      </div>
      <div className="project-time">
        {formatMinutes(minutes)}
        <small>TODAY {isLive ? '• LIVE' : ''}</small>
      </div>
      <button
        className="btn-primary"
        type="button"
        onClick={onStart}
        disabled={!!store.state.activeTimer && !isLive}
        style={
          isLive
            ? { background: `linear-gradient(180deg, ${project.color}, ${project.color}aa)`, color: '#041018' }
            : undefined
        }
      >
        {isLive ? 'Timer Running' : 'Start Timer'}
      </button>
      <div className="todo-label">TO-DO</div>
      <ul className="check-list">
        {tasks.map((task) => (
          <li key={task.id} className="check-item">
            <button
              type="button"
              className={`check-box${task.done ? ' on' : ''}`}
              style={{ borderColor: project.color }}
              onClick={() => store.toggleTask(project.id, task.id)}
            >
              {task.done ? '✓' : ''}
            </button>
            <span className={`check-text${task.done ? ' done' : ''}`}>{task.text}</span>
            <button
              type="button"
              className="x-btn"
              onClick={() => store.removeTask(project.id, task.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault()
          store.addTask(project.id, taskText)
          setTaskText('')
        }}
      >
        <input
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder="+ Add task"
          aria-label={`Add task to ${project.name}`}
        />
      </form>
    </HudPanel>
  )
}
