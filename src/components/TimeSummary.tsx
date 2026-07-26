import { DEEP_WORK_IDS } from '../types'
import { PROJECTS } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { formatLongDate, formatMinutes } from '../utils/time'
import { HudPanel } from './HudPanel'

export function TimeSummary({ store }: { store: Store }) {
  const mode = store.state.summaryMode
  const deepTotal = DEEP_WORK_IDS.reduce((sum, id) => sum + store.minutesFor(id, mode), 0)
  const personal = store.minutesFor('personal', mode)

  const rows = PROJECTS.map((p) => {
    const mins = store.minutesFor(p.id, mode)
    const pctBase =
      p.id === 'personal'
        ? deepTotal + personal || 1
        : deepTotal || 1
    const pct = Math.round((mins / pctBase) * 100)
    return { ...p, mins, pct }
  }).filter((r) => r.mins > 0 || mode === 'day')

  return (
    <HudPanel
      label="TIME SUMMARY"
      action={
        <div className="summary-toggle" role="group" aria-label="Summary range">
          {(['day', 'week', 'total'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'active' : ''}
              onClick={() => store.setSummaryMode(m)}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', letterSpacing: '0.1em' }}>
        {mode === 'day' && formatLongDate(store.state.selectedDate)}
        {mode === 'week' && 'THIS WEEK'}
        {mode === 'total' && 'ALL TIME'}
      </div>
      <div className="big-stat">
        <span>DEEP WORK TOTAL</span>
        {formatMinutes(deepTotal)}
      </div>
      {rows
        .filter((r) => r.id !== 'personal')
        .map((r) => (
          <div key={r.id} className="breakdown-row">
            <span className="dot" style={{ background: r.color, color: r.color }} />
            <span style={{ minWidth: '7rem' }}>{r.name}</span>
            <div className="bar">
              <i style={{ width: `${Math.min(100, r.pct)}%`, background: r.color, color: r.color }} />
            </div>
            <span className="breakdown-meta">
              {formatMinutes(r.mins)} ({r.pct}%)
            </span>
          </div>
        ))}
      {personal > 0 && (
        <div className="breakdown-row" style={{ marginTop: '0.75rem', opacity: 0.85 }}>
          <span className="dot" style={{ background: '#8a8478', color: '#8a8478' }} />
          <span style={{ minWidth: '7rem' }}>Personal Time</span>
          <div className="bar">
            <i
              style={{
                width: `${Math.min(100, Math.round((personal / (deepTotal + personal || 1)) * 100))}%`,
                background: '#8a8478',
                color: '#8a8478',
              }}
            />
          </div>
          <span className="breakdown-meta">{formatMinutes(personal)}</span>
        </div>
      )}
    </HudPanel>
  )
}
