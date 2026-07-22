import { useEffect, useMemo, useRef, useState } from 'react'
import { PROJECT_MAP, PROJECTS } from '../data/seed'
import type { CalendarBlock, ProjectId } from '../types'
import type { Store } from '../hooks/useStore'
import {
  addDays,
  clamp,
  formatDayLabel,
  minutesToTimeLabel,
  parseDateKey,
} from '../utils/time'
import { HudPanel } from './HudPanel'

const DAY_START = 6 * 60 // 6 AM
const DAY_END = 22 * 60 // 10 PM
const RANGE = DAY_END - DAY_START
const PX_PER_MIN = 1.1
const HEIGHT = RANGE * PX_PER_MIN

function snap(mins: number, step = 15) {
  return Math.round(mins / step) * step
}

export function ThreeDayCalendar({ store }: { store: Store }) {
  const center = store.state.selectedDate
  const days = useMemo(() => [addDays(center, -1), center, addDays(center, 1)], [center])
  const scrollRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState<{
    date: string
    start: number
    end: number
  } | null>(null)
  const [editing, setEditing] = useState<CalendarBlock | null>(null)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<ProjectId | ''>('chase')
  const dragging = useRef<{ date: string; startY: number; origin: number } | null>(null)

  useEffect(() => {
    // Scroll to ~8am on mount
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 * 60 - DAY_START) * PX_PER_MIN - 20
    }
  }, [])

  const hours: number[] = []
  for (let m = DAY_START; m <= DAY_END; m += 60) hours.push(m)

  const yToMinutes = (clientY: number, el: HTMLElement) => {
    const colRect = el.getBoundingClientRect()
    const localY = clientY - colRect.top
    const mins = DAY_START + localY / PX_PER_MIN
    return snap(clamp(mins, DAY_START, DAY_END))
  }

  const openCreate = (date: string, start: number, end: number) => {
    const s = Math.min(start, end)
    const e = Math.max(start, end)
    if (e - s < 15) return
    setDraft({ date, start: s, end: e })
    setTitle('')
    setProjectId('chase')
    setEditing(null)
  }

  const openEdit = (block: CalendarBlock) => {
    setEditing(block)
    setTitle(block.title)
    setProjectId(block.projectId || '')
    setDraft(null)
  }

  const saveBlock = () => {
    const trimmed = title.trim() || 'Untitled block'
    if (editing) {
      store.updateCalendarBlock(editing.id, {
        title: trimmed,
        projectId: projectId || undefined,
      })
      setEditing(null)
      return
    }
    if (!draft) return
    store.addCalendarBlock({
      title: trimmed,
      date: draft.date,
      startMinutes: draft.start,
      endMinutes: draft.end,
      projectId: projectId || undefined,
    })
    setDraft(null)
  }

  const blocksFor = (date: string) =>
    store.state.calendarBlocks.filter((b) => b.date === date)

  return (
    <>
      <HudPanel
        label="3-DAY CALENDAR"
        action={
          <div className="month-nav">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => store.setSelectedDate(addDays(center, -1))}
            >
              ‹
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => store.setSelectedDate(addDays(center, 1))}
            >
              ›
            </button>
          </div>
        }
        className="three-day"
      >
        <div className="three-day-header">
          <div />
          {days.map((d) => {
            const { dow, day } = formatDayLabel(d)
            const active = d === center
            const month = parseDateKey(d).toLocaleString('en', { month: 'short' })
            return (
              <div key={d} className={`three-day-col-head${active ? ' active' : ''}`}>
                <div className="dow">{dow.toUpperCase()}</div>
                <div className="date">
                  {day} {month.toUpperCase()}
                </div>
              </div>
            )
          })}
        </div>

        <div className="three-day-body" ref={scrollRef} style={{ height: Math.min(520, HEIGHT) }}>
          <div className="time-gutter" style={{ height: HEIGHT }}>
            {hours.map((m) => (
              <div
                key={m}
                className="time-label"
                style={{ top: (m - DAY_START) * PX_PER_MIN }}
              >
                {minutesToTimeLabel(m)}
              </div>
            ))}
          </div>

          {days.map((date) => (
            <div
              key={date}
              className="day-column"
              style={{ height: HEIGHT }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest('.cal-block')) return
                const col = e.currentTarget
                const start = yToMinutes(e.clientY, col)
                dragging.current = { date, startY: e.clientY, origin: start }
                setDraft({ date, start, end: start + 30 })

                const onMove = (ev: MouseEvent) => {
                  if (!dragging.current) return
                  const end = yToMinutes(ev.clientY, col)
                  setDraft({
                    date: dragging.current.date,
                    start: dragging.current.origin,
                    end: end === dragging.current.origin ? end + 30 : end,
                  })
                }
                const onUp = (ev: MouseEvent) => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                  if (!dragging.current) return
                  const end = yToMinutes(ev.clientY, col)
                  const origin = dragging.current.origin
                  const finalEnd = Math.abs(end - origin) < 15 ? origin + 60 : end
                  openCreate(dragging.current.date, origin, finalEnd)
                  dragging.current = null
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            >
              {hours.map((m) => (
                <div
                  key={m}
                  className="hour-line"
                  style={{ top: (m - DAY_START) * PX_PER_MIN }}
                />
              ))}

              {blocksFor(date).map((block) => {
                const color = block.projectId
                  ? PROJECT_MAP[block.projectId].color
                  : block.color || '#00d4ff'
                const top = (block.startMinutes - DAY_START) * PX_PER_MIN
                const height = Math.max(24, (block.endMinutes - block.startMinutes) * PX_PER_MIN)
                return (
                  <div
                    key={block.id}
                    className="cal-block"
                    style={{
                      top,
                      height,
                      borderColor: color,
                      background: `${color}18`,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => openEdit(block)}
                  >
                    <p className="title">{block.title}</p>
                    <div className="time">
                      {minutesToTimeLabel(block.startMinutes)} – {minutesToTimeLabel(block.endMinutes)}
                    </div>
                  </div>
                )
              })}

              {draft && draft.date === date && !editing && (
                <div
                  className="drag-preview"
                  style={{
                    top: (Math.min(draft.start, draft.end) - DAY_START) * PX_PER_MIN,
                    height: Math.max(
                      20,
                      Math.abs(draft.end - draft.start) * PX_PER_MIN,
                    ),
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <p className="three-day-hint">
          CLICK + DRAG on a day column to create a titled block · CLICK a block to edit
        </p>
      </HudPanel>

      {(draft || editing) && (
        <div className="modal-backdrop" role="presentation" onClick={() => { setDraft(null); setEditing(null) }}>
          <div
            className="modal"
            role="dialog"
            aria-modal
            aria-labelledby="block-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="block-modal-title">
              <span
                className="dot"
                style={{
                  background: projectId ? PROJECT_MAP[projectId].color : '#00d4ff',
                  color: projectId ? PROJECT_MAP[projectId].color : '#00d4ff',
                }}
              />
              {editing ? 'EDIT BLOCK' : 'NEW BLOCK'}
            </h2>
            <p>
              {editing
                ? `${minutesToTimeLabel(editing.startMinutes)} – ${minutesToTimeLabel(editing.endMinutes)}`
                : draft
                  ? `${minutesToTimeLabel(Math.min(draft.start, draft.end))} – ${minutesToTimeLabel(Math.max(draft.start, draft.end))}`
                  : ''}
            </p>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Block title..."
              aria-label="Block title"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveBlock()
              }}
            />
            <label style={{ display: 'block', margin: '0.75rem 0 0.35rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>
              PROJECT
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value as ProjectId | '')}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--line)',
                color: 'var(--text)',
                padding: '0.55rem 0.75rem',
                marginBottom: '1rem',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <option value="">Unassigned</option>
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="btn-row">
              <button className="btn-primary" type="button" onClick={saveBlock}>
                {editing ? 'Save' : 'Add Block'}
              </button>
              {editing && (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    store.removeCalendarBlock(editing.id)
                    setEditing(null)
                  }}
                >
                  Delete
                </button>
              )}
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setDraft(null)
                  setEditing(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
