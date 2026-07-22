import { PROJECTS } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { formatMinutes } from '../utils/time'
import { HudPanel } from './HudPanel'

export function AttentionAllocation({ store }: { store: Store }) {
  const totals = PROJECTS.map((p) => ({
    ...p,
    minutes: store.minutesFor(p.id, 'total'),
  }))
  const allRaw = totals.reduce((s, t) => s + t.minutes, 0)
  const all = allRaw || 1

  // Conic gradient segments
  let cursor = 0
  const stops: string[] = []
  for (const t of totals) {
    const pct = (t.minutes / all) * 100
    if (pct <= 0) continue
    stops.push(`${t.color} ${cursor}% ${cursor + pct}%`)
    cursor += pct
  }
  if (stops.length === 0) stops.push('rgba(255,255,255,0.08) 0% 100%')

  return (
    <HudPanel label="ATTENTION ALLOCATION — ALL TIME">
      <div className="donut-wrap">
        <div
          className="donut"
          style={{ background: `conic-gradient(${stops.join(', ')})` }}
          aria-hidden
        >
          <div className="donut-hole">
            <div>
              <strong>{formatMinutes(allRaw)}</strong>
              <small>ALL TIME</small>
            </div>
          </div>
        </div>
        <div>
          {totals.map((t) => {
            const pct = allRaw === 0 ? 0 : Math.round((t.minutes / allRaw) * 100)
            return (
              <div key={t.id} className="breakdown-row">
                <span className="dot" style={{ background: t.color, color: t.color }} />
                <span style={{ flex: 1 }}>{t.name}</span>
                <span className="breakdown-meta">
                  {formatMinutes(t.minutes)} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </HudPanel>
  )
}
