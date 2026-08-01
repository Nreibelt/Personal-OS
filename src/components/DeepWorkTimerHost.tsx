'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { DEEP_WORK_IDS, type DeepWorkId, type ProjectId } from '../types'
import { formatMinutes, todayDateKey } from '../utils/time'
import { QuickAddTask } from './QuickAddTask'
import { TimerOverlay } from './TimerViews'

/**
 * Platform-wide deep work launcher + timer chrome.
 * Mini dock while browsing; fullscreen only when the user expands (or just started).
 */
export function DeepWorkTimerHost({
  store,
  pendingSession,
  pendingSessionMinimized = false,
  pendingFocusNote = '',
  onPendingSessionHandled,
  browseKey,
}: {
  store: Store
  pendingSession?: ProjectId | null
  /** When true, a pending session starts minimized (e.g. Sunday Admin focus UI owns the screen). */
  pendingSessionMinimized?: boolean
  pendingFocusNote?: string
  onPendingSessionHandled?: () => void
  /** Changes when the user navigates tabs/layers — keeps the timer minimized so UI stays usable */
  browseKey?: string
}) {
  const [timerMinimized, setTimerMinimized] = useState(true)
  const [dockOpen, setDockOpen] = useState(false)
  const hadTimer = useRef(false)
  const skipBrowseMinimize = useRef(false)
  const startMinimizedRef = useRef(false)

  const activeTimer = store.state.activeTimer
  const startTimer = store.startTimer

  const clearPending = useCallback(() => {
    onPendingSessionHandled?.()
  }, [onPendingSessionHandled])

  // Fresh start → enter focus (fullscreen) unless caller asked for minimized.
  useEffect(() => {
    const live = !!activeTimer
    if (live && !hadTimer.current) {
      skipBrowseMinimize.current = true
      setTimerMinimized(startMinimizedRef.current)
      startMinimizedRef.current = false
    }
    if (!live) {
      setTimerMinimized(true)
      setDockOpen(false)
    }
    hadTimer.current = live
  }, [activeTimer])

  // Navigating around the OS must never trap the user under the fullscreen overlay
  useEffect(() => {
    if (!browseKey) return
    if (skipBrowseMinimize.current) {
      skipBrowseMinimize.current = false
      return
    }
    if (activeTimer) setTimerMinimized(true)
    setDockOpen(false)
  }, [browseKey, activeTimer])

  // Pending session requests from dashboard / project cards / Sunday Admin
  useEffect(() => {
    if (!pendingSession) return
    if (activeTimer?.projectId === pendingSession) {
      // Already live — stay minimized so Deep Work UI is usable
      setTimerMinimized(true)
      clearPending()
      return
    }
    if (activeTimer) {
      // Different project live — don't stack a second session
      clearPending()
      return
    }
    startMinimizedRef.current = pendingSessionMinimized
    startTimer(pendingSession, pendingFocusNote)
    clearPending()
  }, [
    pendingSession,
    pendingSessionMinimized,
    pendingFocusNote,
    activeTimer,
    startTimer,
    clearPending,
  ])

  const busy = !!activeTimer

  const startProject = (id: DeepWorkId) => {
    setDockOpen(false)
    if (activeTimer?.projectId === id) {
      setTimerMinimized(false)
      return
    }
    if (activeTimer) return
    startTimer(id, '')
  }

  return (
    <>
      <div className={`corner-dock${busy && timerMinimized ? ' beside-timer' : ''}`}>
        <div className="corner-dock-actions">
          <QuickAddTask store={store} />
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
        </div>
      </div>

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
