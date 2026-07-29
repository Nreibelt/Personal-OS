'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { DEEP_WORK_IDS, type DeepWorkId, type ProjectId } from '../types'
import { formatMinutes, todayDateKey } from '../utils/time'
import { StartSessionModal, TimerOverlay } from './TimerViews'

/**
 * Platform-wide deep work launcher + timer chrome.
 * Mini dock while browsing; fullscreen only when the user expands (or just started).
 */
export function DeepWorkTimerHost({
  store,
  pendingSession,
  onPendingSessionHandled,
  browseKey,
}: {
  store: Store
  pendingSession?: ProjectId | null
  onPendingSessionHandled?: () => void
  /** Changes when the user navigates tabs/layers — keeps the timer minimized so UI stays usable */
  browseKey?: string
}) {
  const [sessionProject, setSessionProject] = useState<ProjectId | null>(null)
  const [timerMinimized, setTimerMinimized] = useState(true)
  const [dockOpen, setDockOpen] = useState(false)
  const hadTimer = useRef(false)
  const skipBrowseMinimize = useRef(false)

  const clearPending = useCallback(() => {
    onPendingSessionHandled?.()
  }, [onPendingSessionHandled])

  // Fresh start → enter focus (fullscreen). Timer cleared → reset.
  useEffect(() => {
    const live = !!store.state.activeTimer
    if (live && !hadTimer.current) {
      skipBrowseMinimize.current = true
      setTimerMinimized(false)
    }
    if (!live) {
      setTimerMinimized(true)
      setDockOpen(false)
    }
    hadTimer.current = live
  }, [store.state.activeTimer])

  // Navigating around the OS must never trap the user under the fullscreen overlay
  useEffect(() => {
    if (!browseKey) return
    if (skipBrowseMinimize.current) {
      skipBrowseMinimize.current = false
      return
    }
    if (store.state.activeTimer) setTimerMinimized(true)
    setDockOpen(false)
  }, [browseKey, store.state.activeTimer])

  // Pending session requests from dashboard / project cards
  useEffect(() => {
    if (!pendingSession) return
    if (store.state.activeTimer?.projectId === pendingSession) {
      // Already live — stay minimized so Deep Work UI is usable
      setTimerMinimized(true)
      clearPending()
      return
    }
    if (store.state.activeTimer) {
      // Different project live — don't stack a second session modal over the timer
      clearPending()
      return
    }
    setSessionProject(pendingSession)
    clearPending()
  }, [pendingSession, store.state.activeTimer, clearPending])

  const busy = !!store.state.activeTimer

  const startProject = (id: DeepWorkId) => {
    setDockOpen(false)
    if (store.state.activeTimer?.projectId === id) {
      setTimerMinimized(false)
      return
    }
    if (store.state.activeTimer) return
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

      {sessionProject && !store.state.activeTimer && (
        <StartSessionModal
          store={store}
          projectId={sessionProject}
          onClose={() => setSessionProject(null)}
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
