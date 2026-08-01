import { useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { formatMinutes, formatTimer, todayDateKey } from '../utils/time'
import { TaskRow } from './TaskRow'
import { ModalPortal } from './ui/ModalPortal'

export function TimerOverlay({
  store,
  minimized,
  onMinimize,
  onExpand,
}: {
  store: Store
  minimized: boolean
  onMinimize: () => void
  onExpand: () => void
}) {
  const timer = store.state.activeTimer
  const [taskText, setTaskText] = useState('')

  if (!timer) return null

  const project = PROJECT_MAP[timer.projectId]
  const displayToday = store.projectMinutesToday[timer.projectId]
  const paused = store.isTimerPaused
  const hasPauses = timer.pauseCount > 0 || paused
  const today = todayDateKey()
  const todayTasks = (store.state.tasks[timer.projectId] ?? []).filter((t) => {
    if (t.archived || t.done) return false
    return typeof t.plannedDate === 'string' ? t.plannedDate === today : t.forToday
  })
  const openCount = todayTasks.filter((t) => !t.done).length

  if (minimized) {
    return (
      <ModalPortal>
        <button
          type="button"
          className={`mini-timer${paused ? ' paused' : ''}`}
          onClick={onExpand}
        >
          <span className="dot" style={{ background: project.color, color: project.color }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', letterSpacing: '0.12em' }}>
            {paused ? 'PAUSED' : project.name.toUpperCase()}
          </span>
          <span className="digits">{formatTimer(store.liveTimerSeconds)}</span>
          {paused && (
            <span className="mini-pause-badge">{formatTimer(store.livePauseSeconds)}</span>
          )}
        </button>
      </ModalPortal>
    )
  }

  return (
    <ModalPortal>
      <div className={`timer-overlay${paused ? ' timer-paused' : ''}`}>
        <div className="timer-stage">
          {paused && (
            <div className="timer-paused-banner">
              <span className="timer-paused-dot" />
              PAUSED · {formatTimer(store.livePauseSeconds)} on break
            </div>
          )}
          <div className="timer-project">
            <span className="dot" style={{ background: project.color, color: project.color }} />
            {project.name.toUpperCase()}
          </div>
          <div className={`timer-digits${paused ? ' frozen' : ''}`}>{formatTimer(store.liveTimerSeconds)}</div>
          <div className="timer-today">TODAY TOTAL · {formatMinutes(displayToday)}</div>
          {hasPauses && (
            <div className="timer-pause-stats">
              {timer.pauseCount} pause{timer.pauseCount === 1 ? '' : 's'} · {formatTimer(store.livePauseSeconds)} total break
            </div>
          )}

          <div className="timer-todos">
            <div className="todo-header">
              <span className="todo-label">TODAY&apos;S TASKS</span>
              <span className="todo-meta">{openCount} open</span>
            </div>
            <ul className="check-list">
              {todayTasks.length === 0 && (
                <li className="empty-tasks">No tasks for today — add one below</li>
              )}
              {todayTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  project={project}
                  store={store}
                  showScope={false}
                />
              ))}
            </ul>
            <form
              className="inline-add"
              onSubmit={(e) => {
                e.preventDefault()
                store.addTask(timer.projectId, taskText, true)
                setTaskText('')
              }}
            >
              <input
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                placeholder="+ Add today's task"
                aria-label={`Add task to ${project.name}`}
              />
            </form>
          </div>

          <div className="timer-actions">
            {paused ? (
              <button className="btn-primary" type="button" onClick={() => store.resumeTimer()}>
                Resume Session
              </button>
            ) : (
              <>
                <button className="btn-primary" type="button" onClick={() => store.finishTimer()}>
                  Finish Session
                </button>
                <button className="btn-secondary btn-pause" type="button" onClick={() => store.pauseTimer()}>
                  Pause
                </button>
              </>
            )}
            {!paused && (
              <button className="btn-secondary" type="button" onClick={onMinimize}>
                Minimize
              </button>
            )}
            <button
              className="ghost-btn"
              type="button"
              style={{ marginTop: '0.5rem' }}
              onClick={() => store.discardTimer()}
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
