'use client'

import { UserButton } from '@clerk/nextjs'
import { useCallback, useEffect, useState } from 'react'
import { CompanyDocumentsView } from './components/business/CompanyDocumentsView'
import { CompanyIdeasView } from './components/business/CompanyIdeasView'
import { CompanyTodosView } from './components/business/CompanyTodosView'
import { AutopilotView } from './components/AutopilotView'
import { CalendarView } from './components/CalendarView'
import { DashboardView } from './components/DashboardView'
import { DeepWorkTimerHost } from './components/DeepWorkTimerHost'
import { FinancesView } from './components/FinancesView'
import { LayerGate } from './components/LayerGate'
import { MentorView } from './components/MentorView'
import { TasksView } from './components/TasksView'
import { VisionView } from './components/VisionView'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { useStore } from './hooks/useStore'
import type { AppLayer, AppTab, BusinessTab, DeepWorkId, ProjectId } from './types'
import { formatLongDate, formatMinutes, todayDateKey } from './utils/time'

const LAYER_KEY = 'batcave-app-layer-v1'
const BUSINESS_TAB_KEY = 'batcave-business-tab-v1'

const PERSONAL_TABS: { id: AppTab; label: string; sub: string; enabled?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', sub: 'Command Center' },
  { id: 'vision', label: 'Vision', sub: 'Horizon' },
  { id: 'autopilot', label: 'Autopilot', sub: 'Set paths' },
  { id: 'calendar', label: 'Calendar', sub: 'Schedule' },
  { id: 'tasks', label: 'Tasks', sub: 'Projects' },
  { id: 'personalFinances', label: 'Personal Finances', sub: 'Personal Finances' },
  { id: 'mentor', label: 'Mentor', sub: 'Synthesis' },
]

const BUSINESS_TABS: {
  id: BusinessTab
  label: string
  enabled: boolean
}[] = [
  { id: 'todos', label: 'To-Dos', enabled: true },
  { id: 'finance', label: 'Finance', enabled: true },
  { id: 'documents', label: 'Documents', enabled: true },
  { id: 'ideas', label: 'Ideas', enabled: true },
  { id: 'metaAds', label: 'Meta Ads', enabled: false },
  { id: 'coldEmail', label: 'Cold Email', enabled: false },
  { id: 'agents', label: 'Agents', enabled: false },
]

function readLayer(): AppLayer {
  try {
    const raw = localStorage.getItem(LAYER_KEY)
    if (raw === 'personal' || raw === 'business' || raw === 'gate') return raw
  } catch {
    // ignore
  }
  return 'gate'
}

function writeLayer(layer: AppLayer) {
  try {
    localStorage.setItem(LAYER_KEY, layer)
  } catch {
    // ignore
  }
}

function readBusinessTab(): BusinessTab {
  try {
    const raw = localStorage.getItem(BUSINESS_TAB_KEY)
    if (raw === 'todos' || raw === 'finance' || raw === 'documents' || raw === 'ideas') return raw
  } catch {
    // ignore
  }
  return 'todos'
}

function writeBusinessTab(tab: BusinessTab) {
  try {
    localStorage.setItem(BUSINESS_TAB_KEY, tab)
  } catch {
    // ignore
  }
}

function requestDocsLeave(proceed: () => void) {
  window.dispatchEvent(
    new CustomEvent('batcave:docs-leave', {
      detail: { proceed },
    }),
  )
}

function NavGlyph({ kind }: { kind: string }) {
  return (
    <span className={`nav-glyph nav-glyph-${kind}`} aria-hidden="true">
      <span className="nav-glyph-core" />
    </span>
  )
}

export default function App() {
  const store = useStore()
  const [layer, setLayer] = useState<AppLayer>('gate')
  const [businessTab, setBusinessTab] = useState<BusinessTab>('todos')
  const [pendingSession, setPendingSession] = useState<ProjectId | null>(null)
  const [pendingSessionMinimized, setPendingSessionMinimized] = useState(false)
  const [pendingFocusNote, setPendingFocusNote] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [docsDirty, setDocsDirty] = useState(false)

  useEffect(() => {
    setLayer(readLayer())
    setBusinessTab(readBusinessTab())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeLayer(layer)
  }, [layer, hydrated])

  useEffect(() => {
    if (!hydrated) return
    writeBusinessTab(businessTab)
  }, [businessTab, hydrated])

  useEffect(() => {
    if (layer === 'personal' && store.state.activeTab === 'companyFinances') {
      store.setActiveTab('personalFinances')
    }
  }, [layer, store])

  const tab = store.state.activeTab === 'companyFinances' ? 'personalFinances' : store.state.activeTab
  const activePersonal = PERSONAL_TABS.find((t) => t.id === tab) ?? PERSONAL_TABS[0]
  const activeBusiness = BUSINESS_TABS.find((t) => t.id === businessTab) ?? BUSINESS_TABS[0]

  const deepToday = store.deepWorkMinutesForDate(store.state.selectedDate)
  const targetHit = store.hitTarget(store.state.selectedDate)
  const allTime = store.minutesFor('all', 'total')

  const clearPendingSession = useCallback(() => {
    setPendingSession(null)
    setPendingSessionMinimized(false)
    setPendingFocusNote('')
  }, [])

  const openTasks = () => {
    if (layer !== 'personal') setLayer('personal')
    store.setActiveTab('tasks')
    store.setSelectedDate(todayDateKey())
  }

  const startSession = (projectId: DeepWorkId | ProjectId) => {
    store.setSelectedDate(todayDateKey())
    openTasks()
    setPendingSessionMinimized(false)
    setPendingFocusNote('')
    setPendingSession(projectId)
  }

  const startPersonalMinimized = (focusNote: string) => {
    setPendingSessionMinimized(true)
    setPendingFocusNote(focusNote)
    setPendingSession('personal')
  }

  const leaveDocumentsIfNeeded = useCallback(
    (proceed: () => void) => {
      if (layer === 'business' && businessTab === 'documents' && docsDirty) {
        requestDocsLeave(proceed)
        return
      }
      proceed()
    },
    [layer, businessTab, docsDirty],
  )

  const enterPersonal = () => {
    if (store.state.activeTab === 'companyFinances') store.setActiveTab('dashboard')
    setLayer('personal')
  }

  const enterBusiness = () => {
    setBusinessTab((t) =>
      t === 'metaAds' || t === 'coldEmail' || t === 'agents' ? 'todos' : t,
    )
    setLayer('business')
  }

  const switchLayerToGate = () => {
    leaveDocumentsIfNeeded(() => {
      setDocsDirty(false)
      setLayer('gate')
    })
  }

  const switchBusinessTab = (next: BusinessTab) => {
    if (next === businessTab) return
    leaveDocumentsIfNeeded(() => {
      setDocsDirty(false)
      setBusinessTab(next)
    })
  }

  const browseKey =
    layer === 'business' ? `biz:${businessTab}` : layer === 'personal' ? `per:${tab}` : 'gate'

  if (!hydrated) {
    return <div className="app-shell layer-loading">Loading…</div>
  }

  if (layer === 'gate') {
    return (
      <div className="app-shell gate-shell gate-shell-bare">
        <LayerGate
          onEnterPersonal={enterPersonal}
          onEnterBusiness={enterBusiness}
          accountSlot={<UserButton />}
        />
      </div>
    )
  }

  const isBusiness = layer === 'business'
  const pageTitle = isBusiness ? activeBusiness.label : activePersonal.label
  const pageSub = isBusiness ? 'Company OS' : activePersonal.sub

  return (
    <div className={`app-shell app-shell-rail${isBusiness ? ' layer-business' : ' layer-personal'}`}>
      <aside className="app-rail" aria-label={isBusiness ? 'Batcave navigation' : 'Command Center navigation'}>
        <div className="rail-brand">
          <span className="rail-mark" aria-hidden="true">
            <span className="rail-mark-core" />
          </span>
          <div className="rail-brand-copy">
            <span className="brand-name">{isBusiness ? 'BATCAVE' : 'COMMAND'}</span>
            <span className="brand-sub">{isBusiness ? 'Company OS' : 'Center'}</span>
          </div>
        </div>

        <nav
          className="rail-nav"
          role="tablist"
          aria-label={isBusiness ? 'Batcave sections' : 'Command Center sections'}
        >
          {isBusiness
            ? BUSINESS_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={businessTab === t.id}
                  className={`rail-item${businessTab === t.id ? ' active' : ''}${t.enabled ? '' : ' disabled'}`}
                  disabled={!t.enabled}
                  onClick={() => {
                    if (t.enabled) switchBusinessTab(t.id)
                  }}
                >
                  <NavGlyph kind={t.id} />
                  <span className="rail-item-label">{t.label}</span>
                  {!t.enabled && <span className="tab-soon">Soon</span>}
                </button>
              ))
            : PERSONAL_TABS.map((t) => {
                const enabled = t.enabled !== false
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`rail-item${tab === t.id ? ' active' : ''}${enabled ? '' : ' disabled'}`}
                    disabled={!enabled}
                    onClick={() => {
                      if (enabled) store.setActiveTab(t.id)
                    }}
                  >
                    <NavGlyph kind={t.id} />
                    <span className="rail-item-label">{t.label}</span>
                    {!enabled && <span className="tab-soon">Soon</span>}
                  </button>
                )
              })}
        </nav>

        <div className="rail-foot">
          <button type="button" className="rail-switch" onClick={switchLayerToGate}>
            <span className="rail-switch-kicker">Layer</span>
            <span className="rail-switch-label">Switch layer</span>
          </button>
        </div>
      </aside>

      <div className="app-stage">
        <header className="command-bar">
          <div className="brand-lockup stage-title">
            <span className="brand-name">{pageTitle}</span>
            <span className="brand-sub">{pageSub}</span>
          </div>
          <div className="status-pills">
            {isBusiness ? (
              <>
                <button
                  type="button"
                  className="ghost-btn"
                  title="Force-upload personal OS browser state to Supabase"
                  onClick={() => void store.pushBrowserToCloud()}
                  disabled={store.cloudSync === 'loading'}
                >
                  Upload → cloud
                </button>
                {store.cloudSync === 'ready' && <span className="status-pill hit">CLOUD</span>}
                {store.cloudSync === 'error' && (
                  <span className="status-pill miss" title={store.cloudError || 'Cloud sync error'}>
                    SYNC ERR
                  </span>
                )}
                <UserButton />
              </>
            ) : (
              <>
                <span className="status-pill">{formatLongDate(store.state.selectedDate)}</span>
                {(tab === 'calendar' || tab === 'tasks') && (
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
                    {store.state.activeTimer && (
                      <span className={`status-pill${store.isTimerPaused ? ' paused' : ' live'}`}>
                        {store.isTimerPaused ? '⏸ PAUSED' : '● LIVE'}
                      </span>
                    )}
                  </>
                )}
                <button
                  className="ghost-btn"
                  type="button"
                  title="Resets deep-work data only — finances are kept"
                  onClick={() => setResetOpen(true)}
                >
                  Reset work
                </button>
                <button
                  className="ghost-btn"
                  type="button"
                  title="Force-upload everything in this browser to Supabase under your account"
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
                  <span className="status-pill hit" title="Saved to Supabase">
                    CLOUD
                  </span>
                )}
                {store.cloudSync === 'error' && (
                  <span className="status-pill miss" title={store.cloudError || 'Cloud sync error'}>
                    SYNC ERR
                  </span>
                )}
                <UserButton />
              </>
            )}
          </div>
        </header>

        <main className="app-content" key={browseKey}>
          {isBusiness ? (
            <>
              {businessTab === 'todos' && <CompanyTodosView />}
              {businessTab === 'finance' && <FinancesView store={store} realm="company" />}
              {businessTab === 'documents' && (
                <CompanyDocumentsView store={store} onDirtyChange={setDocsDirty} />
              )}
              {businessTab === 'ideas' && <CompanyIdeasView store={store} />}
            </>
          ) : (
            <>
              {tab === 'dashboard' && <DashboardView store={store} onStartProject={startSession} />}
              {tab === 'vision' && <VisionView store={store} />}
              {tab === 'autopilot' && (
                <AutopilotView store={store} onStartPersonalMinimized={startPersonalMinimized} />
              )}
              {tab === 'calendar' && <CalendarView store={store} />}
              {tab === 'tasks' && <TasksView store={store} onStartSession={startSession} />}
              {tab === 'personalFinances' && <FinancesView store={store} realm="personal" />}
              {tab === 'mentor' && <MentorView />}
            </>
          )}
        </main>
      </div>

      <DeepWorkTimerHost
        store={store}
        pendingSession={pendingSession}
        pendingSessionMinimized={pendingSessionMinimized}
        pendingFocusNote={pendingFocusNote}
        onPendingSessionHandled={clearPendingSession}
        browseKey={browseKey}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Reset deep work"
        message="Reset deep-work data (tasks, timers, habits)? Personal and company finances are kept."
        confirmLabel="Reset work"
        danger
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false)
          store.resetToSeed()
        }}
      />
    </div>
  )
}
