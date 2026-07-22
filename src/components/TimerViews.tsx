import { useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { ProjectId } from '../types'
import type { Store } from '../hooks/useStore'
import { formatMinutes, formatTimer } from '../utils/time'

export function StartSessionModal({
  store,
  projectId,
  onClose,
}: {
  store: Store
  projectId: ProjectId
  onClose: () => void
}) {
  const project = PROJECT_MAP[projectId]
  const [note, setNote] = useState('')

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal
        aria-labelledby="session-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="session-title">
          <span className="dot" style={{ background: project.color, color: project.color }} />
          START {project.name.toUpperCase()} SESSION
        </h2>
        <p>What are you focusing on this session?</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="List your priorities for this session..."
          autoFocus
        />
        <div className="btn-row">
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              store.startTimer(projectId, note)
              onClose()
            }}
          >
            Start Focus Session
          </button>
        </div>
      </div>
    </div>
  )
}

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
  if (!timer) return null

  const project = PROJECT_MAP[timer.projectId]
  const displayToday = store.projectMinutesToday[timer.projectId]

  if (minimized) {
    return (
      <button type="button" className="mini-timer" onClick={onExpand}>
        <span className="dot" style={{ background: project.color, color: project.color }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', letterSpacing: '0.12em' }}>
          {project.name.toUpperCase()}
        </span>
        <span className="digits">{formatTimer(store.liveTimerSeconds)}</span>
      </button>
    )
  }

  return (
    <div className="timer-overlay">
      <div className="timer-stage">
        <div className="timer-project">
          <span className="dot" style={{ background: project.color, color: project.color }} />
          {project.name.toUpperCase()}
        </div>
        <div className="timer-digits">{formatTimer(store.liveTimerSeconds)}</div>
        <div className="timer-today">TODAY TOTAL • {formatMinutes(displayToday)}</div>
        {timer.focusNote && <p className="timer-note">{timer.focusNote}</p>}
        <div className="timer-actions">
          <button className="btn-primary" type="button" onClick={() => store.finishTimer()}>
            Finish Timer
          </button>
          <button className="btn-secondary" type="button" onClick={onMinimize}>
            Minimize
          </button>
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
  )
}
