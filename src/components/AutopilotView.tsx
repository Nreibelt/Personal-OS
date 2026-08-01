'use client'

import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { EveningWindDown } from './autopilot/EveningWindDown'
import { SaturdayDump } from './autopilot/SaturdayDump'
import { SundayAdmin } from './autopilot/SundayAdmin'
import { SundayCenter } from './autopilot/SundayCenter'
import { WeeklyGoalsPanel } from './WeeklyGoalsPanel'

const ROUTINES = [
  {
    id: 'evening',
    kicker: 'Nightly',
    name: 'Evening Wind Down',
    desc: 'Finance → tomorrow’s calendar → task dates · journal. Close the day on rails.',
    ready: true,
  },
  {
    id: 'saturday-dump',
    kicker: 'Saturday',
    name: 'Saturday Dump',
    desc: 'Notebook → Sunday Admin pile. Allocate tomorrow. Two skips = delete.',
    ready: true,
  },
  {
    id: 'sunday-admin',
    kicker: 'Sunday',
    name: 'Sunday Admin',
    desc: 'One allocated task at a time. Full focus. Personal Time timer on.',
    ready: true,
  },
  {
    id: 'sunday-center',
    kicker: 'Sunday',
    name: 'Sunday Center',
    desc: 'Reflect the week, re-check money, set 3 goals + focus, load tasks, journal.',
    ready: true,
  },
] as const

export function AutopilotView({
  store,
  onStartPersonalMinimized,
}: {
  store: Store
  onStartPersonalMinimized: (focusNote: string) => void
}) {
  const [windDownOpen, setWindDownOpen] = useState(false)
  const [saturdayOpen, setSaturdayOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [sundayOpen, setSundayOpen] = useState(false)

  return (
    <div className="layout-stack autopilot-view">
      <WeeklyGoalsPanel store={store} />

      <section className="action-board">
        <header className="action-board-head">
          <h2 className="action-board-title">Autopilot</h2>
          <p className="action-board-copy">
            Set paths. Press play. Spend thought energy elsewhere.
          </p>
        </header>
        <div className="action-board-grid four">
          {ROUTINES.map((routine) => (
            <button
              key={routine.id}
              type="button"
              className={`action-tile${routine.ready ? ' accent' : ''}${routine.ready ? '' : ' disabled'}`}
              disabled={!routine.ready}
              onClick={() => {
                if (routine.id === 'evening') setWindDownOpen(true)
                if (routine.id === 'saturday-dump') setSaturdayOpen(true)
                if (routine.id === 'sunday-admin') setAdminOpen(true)
                if (routine.id === 'sunday-center') setSundayOpen(true)
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
      <SaturdayDump
        store={store}
        open={saturdayOpen}
        onClose={() => setSaturdayOpen(false)}
      />
      <SundayAdmin
        store={store}
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        onStartPersonalTimer={onStartPersonalMinimized}
      />
      <SundayCenter
        store={store}
        open={sundayOpen}
        onClose={() => setSundayOpen(false)}
      />
    </div>
  )
}
