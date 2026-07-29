import { useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { DEEP_WORK_IDS, type DeepWorkId } from '../types'
import { formatMinutes, todayDateKey } from '../utils/time'
import { Modal } from './ui/Modal'

export function DashboardView({
  store,
  onStartProject,
}: {
  store: Store
  onStartProject: (projectId: DeepWorkId) => void
}) {
  const today = todayDateKey()
  const busy = !!store.state.activeTimer
  const [ritualsOpen, setRitualsOpen] = useState(false)

  return (
    <div className="dashboard dashboard-clean">
      <p className="dashboard-lede">Center. Then move.</p>

      <section className="dashboard-section dashboard-timers">
        <h2 className="dashboard-heading">Start deep work</h2>
        <div className="dashboard-timer-grid">
          {DEEP_WORK_IDS.map((id) => {
            const project = PROJECT_MAP[id]
            let logged = store.minutesFor(id, 'day', today)
            if (store.state.activeTimer?.projectId === id) {
              logged += Math.floor(store.liveTimerSeconds / 60)
            }
            const target = store.state.dailyDeepWorkSplit[id]
            const isLive = store.state.activeTimer?.projectId === id
            return (
              <button
                key={id}
                type="button"
                className={`dashboard-timer-btn${isLive ? ' live' : ''}`}
                style={{ ['--project-color' as string]: project.color }}
                disabled={busy && !isLive}
                onClick={() => onStartProject(id)}
              >
                <span className="dashboard-timer-name">{project.name}</span>
                <span className="dashboard-timer-hours">
                  {formatMinutes(logged)}
                  <span className="dashboard-timer-target">
                    {' '}
                    / {formatMinutes(target)}
                  </span>
                </span>
                <span className="dashboard-timer-cta">
                  {isLive ? 'Timer running — open' : 'Start timer'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="action-board compact">
        <button type="button" className="action-tile compact wide" onClick={() => setRitualsOpen(true)}>
          <span className="action-tile-kicker">Operating cadence</span>
          <span className="action-tile-name">Morning · Evening · Week rituals</span>
          <span className="action-tile-desc">Open when you need the checklist — otherwise stay clear</span>
        </button>
      </section>

      <Modal open={ritualsOpen} onClose={() => setRitualsOpen(false)} title="Rituals" size="md">
        <div className="layout-stack">
          <section className="dashboard-section">
            <h2 className="dashboard-heading">Morning</h2>
            <ol className="dashboard-list">
              <li>Coffee At Home</li>
              <li>Breathwork</li>
              <li>Water &amp; Salt</li>
              <li>Write identity statement and set intentions</li>
              <li>Straight into deep work</li>
            </ol>
          </section>
          <section className="dashboard-section">
            <h2 className="dashboard-heading">Evening</h2>
            <ol className="dashboard-list">
              <li>Plan Tomorrow</li>
              <li>Log Finances</li>
              <li>Write</li>
            </ol>
          </section>
          <section className="dashboard-section">
            <h2 className="dashboard-heading">Week</h2>
            <div className="dashboard-week">
              <div className="dashboard-week-block">
                <span className="dashboard-week-when">Mon–Sun · Midday</span>
                <p>Foot on the fucking gas. Retard mode. Execute.</p>
              </div>
              <div className="dashboard-week-block">
                <span className="dashboard-week-when">Sunday · Afternoon</span>
                <p>Gyroscope. Assess, plan, personal admin, analyse, go deep.</p>
              </div>
              <div className="dashboard-week-block">
                <span className="dashboard-week-when">Sunday · Evening</span>
                <p>Me time. Chill.</p>
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  )
}
