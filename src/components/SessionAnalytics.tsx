import { PROJECT_MAP } from '../data/seed'
import type { Store } from '../hooks/useStore'
import { formatLongDate, formatMinutes, formatTimer } from '../utils/time'
import { hourInAppTz } from '../utils/sessionAnalytics'
import { HudPanel } from './HudPanel'

function HourChart<T extends { hour: number; label: string }>({
  buckets,
  getValue,
  getCount,
  maxValue,
  accent,
  title,
}: {
  buckets: T[]
  getValue: (b: T) => number
  getCount?: (b: T) => number
  maxValue: number
  accent: string
  title: string
}) {
  const peak = maxValue || 1
  return (
    <div className="hour-chart" aria-label={title}>
      <div className="hour-chart-bars">
        {buckets.map((b) => {
          const val = getValue(b)
          const h = val > 0 ? Math.max(4, Math.round((val / peak) * 100)) : 0
          const count = getCount?.(b) ?? 0
          return (
            <div key={b.hour} className="hour-bar-col" title={`${b.label}: ${val}${count ? ` (${count})` : ''}`}>
              <div className="hour-bar-track">
                <div
                  className="hour-bar-fill"
                  style={{ height: `${h}%`, background: accent, color: accent }}
                />
              </div>
              {b.hour % 3 === 0 && <span className="hour-bar-label">{b.label}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SessionAnalytics({ store }: { store: Store }) {
  const mode = store.state.summaryMode
  const stats = store.sessionStats
  const buckets = store.durationBuckets
  const byHour = store.sessionsByHour
  const peak = store.peakSession
  const recent = store.recentSessionEntries

  const maxAvg = Math.max(...byHour.map((b) => b.avgSessionMinutes), 1)
  const maxCount = Math.max(...byHour.map((b) => b.sessionCount), 1)

  const scopeLabel =
    mode === 'day'
      ? formatLongDate(store.state.selectedDate)
      : mode === 'week'
        ? 'THIS WEEK'
        : 'ALL TIME'

  return (
    <HudPanel
      label="SESSION INTELLIGENCE"
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
      <div className="analytics-scope">{scopeLabel}</div>

      {stats.count === 0 ? (
        <p className="analytics-empty">No completed sessions in this range. Finish a focus block to begin tracking.</p>
      ) : (
        <>
          <div className="stat-grid four">
            <div className="stat-cell">
              <span className="stat-kicker">Sessions</span>
              <strong>{stats.count}</strong>
            </div>
            <div className="stat-cell highlight">
              <span className="stat-kicker">Avg length</span>
              <strong>{formatMinutes(stats.avgMinutes)}</strong>
            </div>
            <div className="stat-cell">
              <span className="stat-kicker">Median</span>
              <strong>{formatMinutes(stats.medianMinutes)}</strong>
            </div>
            <div className="stat-cell">
              <span className="stat-kicker">Longest</span>
              <strong>{formatMinutes(stats.maxMinutes)}</strong>
            </div>
          </div>

          <div className="analytics-section">
            <div className="analytics-section-head">
              <span>Duration distribution</span>
              <small>{stats.minMinutes > 0 ? `Shortest ${formatMinutes(stats.minMinutes)}` : ''}</small>
            </div>
            <div className="dist-bars">
              {buckets.map((b) => (
                <div key={b.label} className="dist-row">
                  <span className="dist-label">{b.label}</span>
                  <div className="dist-track">
                    <i style={{ width: `${Math.max(b.count > 0 ? 8 : 0, b.pct)}%` }} />
                  </div>
                  <span className="dist-meta">
                    {b.count} ({b.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {stats.timestampedCount >= 2 && (
            <>
              <div className="analytics-section">
                <div className="analytics-section-head">
                  <span>Avg session length by hour</span>
                  {peak && (
                    <small>
                      Peak {peak.label} · {formatMinutes(peak.avgSessionMinutes)} avg
                    </small>
                  )}
                </div>
                <HourChart
                  buckets={byHour}
                  getValue={(b) => b.avgSessionMinutes}
                  getCount={(b) => b.sessionCount}
                  maxValue={maxAvg}
                  accent="var(--brass)"
                  title="Average session length by hour of day"
                />
              </div>

              <div className="analytics-section">
                <div className="analytics-section-head">
                  <span>Session frequency by hour</span>
                </div>
                <HourChart
                  buckets={byHour}
                  getValue={(b) => b.sessionCount}
                  getCount={(b) => b.sessionCount}
                  maxValue={maxCount}
                  accent="#6b8fb0"
                  title="Session count by hour of day"
                />
              </div>
            </>
          )}

          {stats.timestampedCount < 2 && stats.count > 0 && (
            <p className="analytics-hint">
              Time-of-day trends unlock after sessions record start timestamps. New sessions track this automatically.
            </p>
          )}

          {recent.length > 0 && (
            <div className="analytics-section">
              <div className="analytics-section-head">
                <span>Recent sessions</span>
              </div>
              <ul className="session-list">
                {recent.map((entry) => {
                  const project = PROJECT_MAP[entry.projectId]
                  const startLabel =
                    entry.startedAt != null
                      ? `${hourInAppTz(entry.startedAt) % 12 || 12}${hourInAppTz(entry.startedAt) >= 12 ? 'pm' : 'am'}`
                      : entry.date
                  return (
                    <li key={entry.id} className="session-list-item">
                      <span className="dot" style={{ background: project.color, color: project.color }} />
                      <span className="session-list-project">{project.name}</span>
                      <span className="session-list-time">{startLabel}</span>
                      <span className="session-list-dur">{formatMinutes(entry.minutes)}</span>
                      {(entry.pauseCount ?? 0) > 0 && (
                        <span className="session-list-pause">{entry.pauseCount} pause{entry.pauseCount === 1 ? '' : 's'}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </HudPanel>
  )
}

export function PauseAnalytics({ store }: { store: Store }) {
  const mode = store.state.summaryMode
  const stats = store.pauseStats
  const byHour = store.pausesByHour
  const peak = store.peakPause

  const maxAvg = Math.max(...byHour.map((b) => b.avgPauseMinutes), 1)
  const maxCount = Math.max(...byHour.map((b) => b.pauseCount), 1)

  const scopeLabel =
    mode === 'day'
      ? formatLongDate(store.state.selectedDate)
      : mode === 'week'
        ? 'THIS WEEK'
        : 'ALL TIME'

  return (
    <HudPanel label="PAUSE INTELLIGENCE">
      <div className="analytics-scope">{scopeLabel}</div>

      {stats.totalPauses === 0 ? (
        <p className="analytics-empty">
          No pauses logged yet. Use Pause during a live session — breaks are tracked separately from stop.
        </p>
      ) : (
        <>
          <div className="stat-grid four">
            <div className="stat-cell highlight">
              <span className="stat-kicker">Total pauses</span>
              <strong>{stats.totalPauses}</strong>
            </div>
            <div className="stat-cell">
              <span className="stat-kicker">Pause time</span>
              <strong>{formatMinutes(stats.totalPauseMinutes)}</strong>
            </div>
            <div className="stat-cell">
              <span className="stat-kicker">Avg pause</span>
              <strong>{formatMinutes(stats.avgPauseMinutes)}</strong>
            </div>
            <div className="stat-cell">
              <span className="stat-kicker">Sessions w/ pause</span>
              <strong>{stats.pauseRate}%</strong>
            </div>
          </div>

          {stats.timestampedPauseCount >= 2 && (
            <>
              <div className="analytics-section">
                <div className="analytics-section-head">
                  <span>Avg pause length by hour</span>
                  {peak && (
                    <small>
                      Most pauses {peak.label} · {peak.pauseCount}×
                    </small>
                  )}
                </div>
                <HourChart
                  buckets={byHour}
                  getValue={(b) => b.avgPauseMinutes}
                  getCount={(b) => b.pauseCount}
                  maxValue={maxAvg}
                  accent="#c4a574"
                  title="Average pause length by hour of day"
                />
              </div>

              <div className="analytics-section">
                <div className="analytics-section-head">
                  <span>Pause frequency by hour</span>
                </div>
                <HourChart
                  buckets={byHour}
                  getValue={(b) => b.pauseCount}
                  getCount={(b) => b.pauseCount}
                  maxValue={maxCount}
                  accent="#a39a82"
                  title="Pause count by hour of day"
                />
              </div>
            </>
          )}

          {store.isTimerPaused && (
            <div className="live-pause-banner">
              <span className="live-pause-dot" />
              Currently paused · {formatTimer(store.livePauseSeconds)} elapsed
            </div>
          )}
        </>
      )}
    </HudPanel>
  )
}
