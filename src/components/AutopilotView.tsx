'use client'

import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { EveningWindDown } from './autopilot/EveningWindDown'

const ROUTINES = [
  {
    id: 'evening',
    kicker: 'Nightly',
    name: 'Evening Wind Down',
    desc: 'Finance → tomorrow’s calendar → task dates → journal. Close the day on rails.',
    ready: true,
  },
  {
    id: 'sunday-admin',
    kicker: 'Sunday',
    name: 'Sunday Admin',
    desc: 'Clear the admin pile. Coming soon.',
    ready: false,
  },
  {
    id: 'sunday-prep',
    kicker: 'Sunday',
    name: 'Sunday Week Prep',
    desc: 'Load the week so Monday starts already decided. Coming soon.',
    ready: false,
  },
] as const

export function AutopilotView({ store }: { store: Store }) {
  const [windDownOpen, setWindDownOpen] = useState(false)

  return (
    <div className="layout-stack autopilot-view">
      <section className="action-board">
        <header className="action-board-head">
          <h2 className="action-board-title">Autopilot</h2>
          <p className="action-board-copy">
            Set paths. Press play. Spend thought energy elsewhere.
          </p>
        </header>
        <div className="action-board-grid">
          {ROUTINES.map((routine) => (
            <button
              key={routine.id}
              type="button"
              className={`action-tile${routine.ready ? ' accent' : ''}${routine.ready ? '' : ' disabled'}`}
              disabled={!routine.ready}
              onClick={() => {
                if (routine.id === 'evening') setWindDownOpen(true)
              }}
            >
              <span className="action-tile-kicker">{routine.kicker}</span>
              <span className="action-tile-name">{routine.name}</span>
              <span className="action-tile-desc">{routine.desc}</span>
              {!routine.ready && <span className="tab-soon">Soon</span>}
            </button>
          ))}
        </div>
      </section>

      <EveningWindDown
        store={store}
        open={windDownOpen}
        onClose={() => setWindDownOpen(false)}
      />
    </div>
  )
}
