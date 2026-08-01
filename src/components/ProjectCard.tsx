import { useState } from 'react'
import type { Project } from '../types'
import type { Store } from '../hooks/useStore'
import { formatMinutes, todayDateKey } from '../utils/time'
import { HudPanel } from './HudPanel'
import { TaskRow } from './TaskRow'

function isTodayTask(plannedDate: string | null | undefined, forToday: boolean, today: string) {
  if (typeof plannedDate === 'string') return plannedDate === today
  if (plannedDate === null) return false
  return forToday
}

function isActiveTask(task: { done: boolean; archived?: boolean }) {
  return !task.archived && !task.done
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
  const allTasks = (store.state.tasks[project.id] ?? []).filter(isActiveTask)
  const showAll = store.state.showAllTasks
  const today = todayDateKey()
  const todayTasks = allTasks.filter((t) => isTodayTask(t.plannedDate, t.forToday, today))
  const laterTasks = allTasks.filter((t) => !isTodayTask(t.plannedDate, t.forToday, today))
  const isLive = store.state.activeTimer?.projectId === project.id
  const isPaused = isLive && store.isTimerPaused
  const visible = showAll ? allTasks : todayTasks
  const showTimer = project.id !== 'sundayAdmin'
  // Personal Time is timer-only — tasks live under Sunday Admin.
  const showTasks = project.id !== 'personal'

  return (
    <HudPanel className="project-card" style={{ borderColor: `${project.color}44` }}>
      <div className="project-head">
        <span className="dot" style={{ background: project.color }} />
        <h3 className="project-name" style={{ color: project.color }}>
          {project.name}
        </h3>
      </div>
      {showTimer && (
        <>
          <div className="project-time">
            {formatMinutes(minutes)}
            <small>TODAY {isPaused ? '• PAUSED' : isLive ? '• LIVE' : ''}</small>
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
            {isPaused ? 'Paused' : isLive ? 'Timer Running' : 'Start Timer'}
          </button>
        </>
      )}

      {showTasks ? (
        <>
          <div className="todo-header">
            <span className="todo-label">{showAll ? 'ALL TASKS' : "TODAY'S TASKS"}</span>
            <span className="todo-meta">
              {todayTasks.length} today
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
        </>
      ) : (
        <p className="empty-tasks" style={{ marginTop: '0.85rem' }}>
          Tasks live in Sunday Admin — use Saturday Dump / Autopilot.
        </p>
      )}
    </HudPanel>
  )
}
