'use client'

import { useEffect, useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { DEEP_WORK_IDS, type DeepWorkId, type ProjectId } from '../types'
import { formatMinutes, todayDateKey } from '../utils/time'
import { StartSessionModal, TimerOverlay } from './TimerViews'

/**
 * Platform-wide deep work launcher + timer chrome.
 * Sticky dock when idle; mini/fullscreen overlay when live.
 */
export function DeepWorkTimerHost({
  store,
  pendingSession,
  onPendingSessionHandled,
}: {
  store: Store
  pendingSession?: ProjectId | null
  onPendingSessionHandled?: () => void
}) {
  const [sessionProject, setSessionProject] = useState<ProjectId | null>(null)
  const [timerMinimized, setTimerMinimized] = useState(false)
  const [dockOpen, setDockOpen] = useState(false)

  useEffect(() => {
    if (!pendingSession) return
    if (store.state.activeTimer?.projectId === pendingSession) {
      setTimerMinimized(false)
      onPendingSessionHandled?.()
      return
    }
    setSessionProject(pendingSession)
    setTimerMinimized(false)
    onPendingSessionHandled?.()
  }, [pendingSession, store.state.activeTimer?.projectId, onPendingSessionHandled])

  const busy = !!store.state.activeTimer

  const startProject = (id: DeepWorkId) => {
    setDockOpen(false)
    if (store.state.activeTimer?.projectId === id) {
      setTimerMinimized(false)
      return
    }
    setSessionProject(id)
  }

  return (
    <>
      {!busy && (
        <div className={`deep-dock${dockOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="deep-dock-toggle"
            aria-expanded={dockOpen}
            onClick={() => setDockOpen((v) => !v)}
          >
            <span className="deep-dock-pulse" aria-hidden />
            Deep work
          </button>
          {dockOpen && (
            <div className="deep-dock-panel" role="menu">
              <p className="deep-dock-hint">Start a focus session</p>
              {DEEP_WORK_IDS.map((id) => {
                const project = PROJECT_MAP[id]
                const logged = store.minutesFor(id, 'day', todayDateKey())
                const target = store.state.dailyDeepWorkSplit[id]
                return (
                  <button
                    key={id}
                    type="button"
                    className="deep-dock-item"
                    role="menuitem"
                    style={{ ['--project-color' as string]: project.color }}
                    onClick={() => startProject(id)}
                  >
                    <span className="deep-dock-name">{project.name}</span>
                    <span className="deep-dock-meta">
                      {formatMinutes(logged)} / {formatMinutes(target)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

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

/** Hook-friendly API for Deep Work project cards to open a session via App host */
export type DeepWorkSessionRequest = (projectId: ProjectId) => void
