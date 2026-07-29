import { useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { ProjectId } from '../types'
import type { Store } from '../hooks/useStore'
import { formatMinutes, formatTimer } from '../utils/time'
import { ModalPortal } from './ui/ModalPortal'

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
    <ModalPortal>
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
    </ModalPortal>
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
  const paused = store.isTimerPaused
  const hasPauses = timer.pauseCount > 0 || paused

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
          {timer.focusNote && <p className="timer-note">{timer.focusNote}</p>}
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
