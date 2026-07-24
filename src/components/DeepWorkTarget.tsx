import { useState } from 'react'
import { PROJECT_MAP } from '../data/seed'
import type { Store } from '../hooks/useStore'
import type { DeepWorkId } from '../types'
import { DEEP_WORK_IDS, equalDeepWorkSplit, scaleDeepWorkSplit } from '../types'
import { formatMinutes } from '../utils/time'
import { HudPanel } from './HudPanel'

function hoursValue(minutes: number) {
  const h = minutes / 60
  return Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10)
}

function splitToDraft(split: Record<DeepWorkId, number>): Record<DeepWorkId, string> {
  return {
    chase: hoursValue(split.chase),
    myProject: hoursValue(split.myProject),
    rav: hoursValue(split.rav),
  }
}

export function DeepWorkTarget({ store }: { store: Store }) {
  const target = store.state.dailyDeepWorkTargetMinutes
  const split = store.state.dailyDeepWorkSplit
  const deep = store.deepWorkMinutesForDate(store.state.selectedDate)
  const pct = Math.min(100, Math.round((deep / (target || 1)) * 100))
  const hit = deep >= target
  const [editing, setEditing] = useState(false)
  const [hoursDraft, setHoursDraft] = useState(hoursValue(target))
  const [splitDraft, setSplitDraft] = useState<Record<DeepWorkId, string>>(splitToDraft(split))

  const allocatedDraft = DEEP_WORK_IDS.reduce(
    (s, id) => s + (Number(splitDraft[id]) || 0),
    0,
  )
  const totalDraft = Number(hoursDraft) || 0
  const allocDelta = Math.round((allocatedDraft - totalDraft) * 10) / 10

  const beginEdit = () => {
    setHoursDraft(hoursValue(target))
    setSplitDraft(splitToDraft(split))
    setEditing(true)
  }

  const applyTotalToSplitDraft = (hoursStr: string) => {
    setHoursDraft(hoursStr)
    const hours = Number(hoursStr)
    if (!Number.isFinite(hours) || hours <= 0) return
    const minutes = Math.round(Math.max(0.5, Math.min(16, hours)) * 60)
    const current: Record<DeepWorkId, number> = {
      chase: Math.max(0, Math.round((Number(splitDraft.chase) || 0) * 60)),
      myProject: Math.max(0, Math.round((Number(splitDraft.myProject) || 0) * 60)),
      rav: Math.max(0, Math.round((Number(splitDraft.rav) || 0) * 60)),
    }
    const sum = DEEP_WORK_IDS.reduce((s, id) => s + current[id], 0)
    const next = sum <= 0 ? equalDeepWorkSplit(minutes) : scaleDeepWorkSplit(current, minutes)
    setSplitDraft(splitToDraft(next))
  }

  const save = () => {
    const parts: Record<DeepWorkId, number> = {
      chase: Number(splitDraft.chase) || 0,
      myProject: Number(splitDraft.myProject) || 0,
      rav: Number(splitDraft.rav) || 0,
    }
    const splitSum = DEEP_WORK_IDS.reduce((s, id) => s + parts[id], 0)
    if (splitSum > 0) {
      store.setDailyDeepWorkSplit(parts)
    } else {
      store.setDailyTargetHours(Number(hoursDraft) || 6)
    }
    setEditing(false)
  }

  return (
    <HudPanel
      label="DAILY DEEP WORK TARGET"
      action={
        !editing ? (
          <button className="edit-btn" type="button" onClick={beginEdit}>
            Set target
          </button>
        ) : null
      }
    >
      <div className="big-stat" style={{ marginBottom: '0.25rem' }}>
        <span>PROGRESS</span>
        {formatMinutes(deep)}
        <span
          style={{
            display: 'inline',
            marginLeft: '0.35rem',
            fontSize: '0.85rem',
            color: 'var(--text-dim)',
            letterSpacing: '0.04em',
          }}
        >
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

      <div className="target-split" aria-label="Deep work allocation by section">
        {DEEP_WORK_IDS.map((id) => {
          const project = PROJECT_MAP[id]
          const sectionTarget = split[id]
          const done = store.projectMinutesToday[id]
          const sectionPct = Math.min(
            100,
            Math.round((done / (sectionTarget || 1)) * 100),
          )
          const sectionHit = done >= sectionTarget && sectionTarget > 0
          return (
            <div key={id} className="target-split-row">
              <span className="dot" style={{ background: project.color, color: project.color }} />
              <span className="target-split-name">{project.name}</span>
              <div className={`target-bar thin${sectionHit ? ' hit' : ''}`}>
                <i
                  style={{
                    width: `${sectionPct}%`,
                    background: project.color,
                    color: project.color,
                  }}
                />
              </div>
              <span className="target-split-meta">
                {formatMinutes(done)} / {formatMinutes(sectionTarget)}
              </span>
            </div>
          )
        })}
      </div>

      {editing && (
        <div className="target-edit-block">
          <div className="target-edit">
            <label htmlFor="target-hours">Total hours / day</label>
            <input
              id="target-hours"
              type="number"
              min={0.5}
              max={16}
              step={0.5}
              value={hoursDraft}
              onChange={(e) => applyTotalToSplitDraft(e.target.value)}
            />
          </div>

          <div className="target-split-edit">
            <span className="target-split-edit-label">Allocate across sections</span>
            {DEEP_WORK_IDS.map((id) => {
              const project = PROJECT_MAP[id]
              return (
                <div key={id} className="target-edit">
                  <label htmlFor={`split-${id}`}>
                    <span className="dot" style={{ background: project.color }} />
                    {project.name}
                  </label>
                  <input
                    id={`split-${id}`}
                    type="number"
                    min={0}
                    max={16}
                    step={0.5}
                    value={splitDraft[id]}
                    onChange={(e) =>
                      setSplitDraft((d) => ({ ...d, [id]: e.target.value }))
                    }
                  />
                </div>
              )
            })}
            <p
              className={`target-alloc-hint${allocDelta === 0 ? ' ok' : ''}`}
              role="status"
            >
              {allocDelta === 0
                ? `Allocated ${allocatedDraft}h of ${totalDraft || 0}h`
                : allocDelta > 0
                  ? `Over by ${allocDelta}h — save sets total to ${allocatedDraft}h`
                  : `${Math.abs(allocDelta)}h unallocated — save sets total to ${allocatedDraft}h`}
            </p>
          </div>

          <div className="target-edit-actions">
            <button className="btn-primary" type="button" onClick={save}>
              Save
            </button>
            <button className="btn-secondary" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
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
