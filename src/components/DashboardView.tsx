import { useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { DEEP_WORK_IDS, type DeepWorkId } from '../types'
import { formatMinutes, todayDateKey } from '../utils/time'
import { Modal } from './ui/Modal'

type RitualId = 'morning' | 'evening' | 'week'

const RITUAL_CARDS: {
  id: RitualId
  title: string
  name: string
}[] = [
  { id: 'morning', title: 'Morning', name: 'Morning rituals' },
  { id: 'evening', title: 'Evening', name: 'Evening rituals' },
  { id: 'week', title: 'Week', name: 'Week rituals' },
]

export function DashboardView({
  store,
  onStartProject,
}: {
  store: Store
  onStartProject: (projectId: DeepWorkId) => void
}) {
  const today = todayDateKey()
  const busy = !!store.state.activeTimer
  const [ritualOpen, setRitualOpen] = useState<RitualId | null>(null)
  const activeRitual = RITUAL_CARDS.find((card) => card.id === ritualOpen)

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
        <div className="action-board-stack">
          {RITUAL_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              className="action-tile compact wide"
              onClick={() => setRitualOpen(card.id)}
            >
              <span className="action-tile-kicker">Operating cadence</span>
              <span className="action-tile-name">{card.name}</span>
              <span className="action-tile-desc">
                Open when you need the checklist — otherwise stay clear
              </span>
            </button>
          ))}
        </div>
      </section>

      <Modal
        open={ritualOpen !== null}
        onClose={() => setRitualOpen(null)}
        title={activeRitual?.title ?? 'Rituals'}
        size="md"
      >
        {ritualOpen === 'morning' && (
          <ol className="dashboard-list">
            <li>Coffee At Home</li>
            <li>Breathwork</li>
            <li>Water &amp; Salt</li>
            <li>Write identity statement and set intentions</li>
            <li>Straight into deep work</li>
          </ol>
        )}
        {ritualOpen === 'evening' && (
          <ol className="dashboard-list">
            <li>Plan Tomorrow</li>
            <li>Log Finances</li>
            <li>Write</li>
          </ol>
        )}
        {ritualOpen === 'week' && (
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
        )}
      </Modal>
    </div>
  )
}
