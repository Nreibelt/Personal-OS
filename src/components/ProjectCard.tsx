import { useState } from 'react'
import type { Project, Task } from '../types'
import type { Store } from '../hooks/useStore'
import { formatMinutes } from '../utils/time'
import { HudPanel } from './HudPanel'

function TaskRow({
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
  const allTasks = store.state.tasks[project.id]
  const showAll = store.state.showAllTasks
  const todayTasks = allTasks.filter((t) => t.forToday)
  const laterTasks = allTasks.filter((t) => !t.forToday)
  const isLive = store.state.activeTimer?.projectId === project.id
  const visible = showAll ? allTasks : todayTasks

  return (
    <HudPanel className="project-card" style={{ borderColor: `${project.color}44` }}>
      <div className="project-head">
        <span className="dot" style={{ background: project.color }} />
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
            ? { background: project.color, color: '#0c0c0c' }
            : undefined
        }
      >
        {isLive ? 'Timer Running' : 'Start Timer'}
      </button>

      <div className="todo-header">
        <span className="todo-label">{showAll ? 'ALL TASKS' : "TODAY'S TASKS"}</span>
        <span className="todo-meta">
          {todayTasks.filter((t) => !t.done).length} today
          {laterTasks.length > 0 ? ` · ${laterTasks.length} later` : ''}
        </span>
      </div>

      {showAll ? (
        <>
          <div className="task-section-label">Today</div>
          <ul className="check-list">
            {todayTasks.length === 0 && <li className="empty-tasks">Nothing planned for today</li>}
            {todayTasks.map((task) => (
              <TaskRow key={task.id} task={task} project={project} store={store} showScope />
            ))}
          </ul>
          <div className="task-section-label future-label">Backlog</div>
          <ul className="check-list">
            {laterTasks.length === 0 && <li className="empty-tasks">Empty backlog</li>}
            {laterTasks.map((task) => (
              <TaskRow key={task.id} task={task} project={project} store={store} showScope />
            ))}
          </ul>
        </>
      ) : (
        <ul className="check-list">
          {visible.length === 0 && (
            <li className="empty-tasks">No tasks for today — dump into backlog via Show all</li>
          )}
          {visible.map((task) => (
            <TaskRow key={task.id} task={task} project={project} store={store} showScope={false} />
          ))}
        </ul>
      )}

      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault()
          // When viewing all, new tasks go to backlog by default (brain dump).
          // When viewing today, new tasks are for today.
          store.addTask(project.id, taskText, !showAll)
          setTaskText('')
        }}
      >
        <input
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder={showAll ? '+ Brain dump task' : "+ Add today's task"}
          aria-label={`Add task to ${project.name}`}
        />
      </form>
    </HudPanel>
  )
}
