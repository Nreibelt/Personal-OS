import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { formatMinutes } from '../utils/time'
import { HudPanel } from './HudPanel'

export function DeepWorkTarget({ store }: { store: Store }) {
  const target = store.state.dailyDeepWorkTargetMinutes
  const deep = store.deepWorkMinutesForDate(store.state.selectedDate)
  const pct = Math.min(100, Math.round((deep / (target || 1)) * 100))
  const hit = deep >= target
  const [editing, setEditing] = useState(false)
  const [hoursDraft, setHoursDraft] = useState(String(target / 60))

  return (
    <HudPanel
      label="DAILY DEEP WORK TARGET"
      action={
        !editing ? (
          <button
            className="edit-btn"
            type="button"
            onClick={() => {
              setHoursDraft(String(target / 60))
              setEditing(true)
            }}
          >
            Set target
          </button>
        ) : null
      }
    >
      <div className="big-stat" style={{ marginBottom: '0.25rem' }}>
        <span>PROGRESS</span>
        {formatMinutes(deep)}
        <span style={{ display: 'inline', marginLeft: '0.35rem', fontSize: '0.85rem', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
          / {formatMinutes(target)}
        </span>
      </div>

      <div className="target-progress">
        <div className={`target-bar${hit ? ' hit' : ''}`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="target-stats">
          <span>{pct}%</span>
          <span className={hit ? 'status-hit' : 'status-miss'}>
            {hit ? 'TARGET HIT' : 'IN PROGRESS'}
          </span>
        </div>
      </div>

      {editing && (
        <div className="target-edit">
          <label htmlFor="target-hours">Hours / day</label>
          <input
            id="target-hours"
            type="number"
            min={0.5}
            max={16}
            step={0.5}
            value={hoursDraft}
            onChange={(e) => setHoursDraft(e.target.value)}
          />
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              store.setDailyTargetHours(Number(hoursDraft) || 6)
              setEditing(false)
            }}
          >
            Save
          </button>
          <button className="btn-secondary" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      )}

      <div className="streak-row">
        <div className="streak-stat">
          <strong>{store.targetStreak}</strong>
          <span>Hit streak</span>
        </div>
        <div className="streak-stat">
          <strong>
            {store.weekHitRate.hits}/{store.weekHitRate.counted || 0}
          </strong>
          <span>Week hits</span>
        </div>
        <div className="streak-stat">
          <strong>{formatMinutes(target)}</strong>
          <span>Daily bar</span>
        </div>
      </div>
    </HudPanel>
  )
}

export function DailyOneThing({ store }: { store: Store }) {
  const date = store.state.selectedDate
  const value = store.state.dailyOneThing[date] || ''

  return (
    <HudPanel label="TODAY'S ONE THING">
      <input
        className="one-thing-input"
        value={value}
        onChange={(e) => store.setOneThing(date, e.target.value)}
        placeholder="If everything else slips — this still ships."
        aria-label="Today's one thing"
      />
      <p className="one-thing-hint">
        Protect this above everything. Clarity beats volume.
      </p>
    </HudPanel>
  )
}
