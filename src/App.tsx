'use client'

import { UserButton } from '@clerk/nextjs'
import { useState } from 'react'
import { DashboardView } from './components/DashboardView'
import { DeepWorkView } from './components/DeepWorkView'
import { FinancesView } from './components/FinancesView'
import { useStore } from './hooks/useStore'
import type { AppTab, DeepWorkId, ProjectId } from './types'
import { formatLongDate, formatMinutes, todayDateKey } from './utils/time'

const TABS: { id: AppTab; label: string; sub: string }[] = [
  { id: 'dashboard', label: 'Dashboard', sub: 'Dashboard' },
  { id: 'deepWork', label: 'Deep Work', sub: 'Deep Work' },
  { id: 'companyFinances', label: 'Company Finances', sub: 'Company Finances' },
  { id: 'personalFinances', label: 'Personal Finances', sub: 'Personal Finances' },
]

export default function App() {
  const store = useStore()
  const tab = store.state.activeTab
  const activeMeta = TABS.find((t) => t.id === tab) ?? TABS[0]
  const [pendingSession, setPendingSession] = useState<ProjectId | null>(null)

  const deepToday = store.deepWorkMinutesForDate(store.state.selectedDate)
  const targetHit = store.hitTarget(store.state.selectedDate)
  const allTime = store.minutesFor('all', 'total')

  const startFromDashboard = (projectId: DeepWorkId) => {
    store.setSelectedDate(todayDateKey())
    if (store.state.activeTimer?.projectId === projectId) {
      store.setActiveTab('deepWork')
      setPendingSession(null)
      return
    }
    store.setActiveTab('deepWork')
    setPendingSession(projectId)
  }

  return (
    <div className="app-shell">
      <header className="command-bar">
        <div className="brand-lockup">
          <span className="brand-name">BATCAVE</span>
          <span className="brand-sub">{activeMeta.sub}</span>
        </div>
        <div className="status-pills">
          <span className="status-pill">{formatLongDate(store.state.selectedDate)}</span>
          {tab === 'deepWork' && (
            <>
              <span className={`status-pill ${targetHit ? 'hit' : 'miss'}`}>
                DEEP <strong>{formatMinutes(deepToday)}</strong>
                <span style={{ opacity: 0.7 }}>
                  {' '}
                  / {formatMinutes(store.state.dailyDeepWorkTargetMinutes)}
                </span>
              </span>
              <span className="status-pill">
                STREAK <strong>{store.targetStreak}</strong>
              </span>
              <span className="status-pill">
                TOTAL <strong>{formatMinutes(allTime)}</strong>
              </span>
              {store.state.activeTimer && <span className="status-pill live">● LIVE</span>}
            </>
          )}
          <button
            className="ghost-btn"
            type="button"
            title="Resets deep-work data only — finances are kept"
            onClick={() => store.resetToSeed()}
          >
            Reset work
          </button>
          <button
            className="ghost-btn"
            type="button"
            title="Force-upload everything in this browser (tasks, habits, finances, Revolut) to Supabase under your account"
            onClick={() => void store.pushBrowserToCloud()}
            disabled={store.cloudSync === 'loading'}
          >
            Upload → cloud
          </button>
          {store.cloudSync === 'loading' && (
            <span className="status-pill" title="Loading cloud state">
              SYNC…
            </span>
          )}
          {store.cloudSync === 'ready' && (
            <span
              className="status-pill hit"
              title={
                store.cloudSource === 'local'
                  ? 'Browser data saved to Supabase under your account'
                  : 'Loaded from Supabase; changes auto-save'
              }
            >
              CLOUD
            </span>
          )}
          {store.cloudSync === 'error' && (
            <span
              className="status-pill miss"
              title={store.cloudError || 'Cloud sync error'}
            >
              SYNC ERR
            </span>
          )}
          <UserButton />
        </div>
      </header>

      <nav className="app-tabs" role="tablist" aria-label="Platform sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`app-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => store.setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <DashboardView store={store} onStartProject={startFromDashboard} />
      )}
      {tab === 'deepWork' && (
        <DeepWorkView
          store={store}
          pendingSession={pendingSession}
          onPendingSessionHandled={() => setPendingSession(null)}
        />
      )}
      {tab === 'personalFinances' && <FinancesView store={store} realm="personal" />}
      {tab === 'companyFinances' && <FinancesView store={store} realm="company" />}
    </div>
  )
}
