import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
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
const SLOT = 15

function snap(mins: number, step = SLOT) {
  return Math.round(mins / step) * step
}

function buildTimeOptions() {
  const opts: number[] = []
  for (let m = DAY_START; m <= DAY_END; m += SLOT) opts.push(m)
  return opts
}

const TIME_OPTIONS = buildTimeOptions()

type RangeDraft = { date: string; start: number; end: number }

export function ThreeDayCalendar({ store }: { store: Store }) {
  const center = store.state.selectedDate
  const days = useMemo(() => [addDays(center, -1), center, addDays(center, 1)], [center])
  const scrollRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<Map<string, HTMLElement>>(new Map())

  // Modal create draft — only set after drag finishes
  const [draft, setDraft] = useState<RangeDraft | null>(null)
  // Live ghost while dragging to create (does not open modal)
  const [createPreview, setCreatePreview] = useState<RangeDraft | null>(null)
  // Live position while dragging an existing block
  const [movePreview, setMovePreview] = useState<(RangeDraft & { id: string }) | null>(null)

  const [editing, setEditing] = useState<CalendarBlock | null>(null)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<ProjectId | ''>('chase')
  const [startMinutes, setStartMinutes] = useState(DAY_START)
  const [endMinutes, setEndMinutes] = useState(DAY_START + 60)

  const createDrag = useRef<{ date: string; origin: number } | null>(null)
  const moveDrag = useRef<{
    id: string
    duration: number
    grabOffsetMins: number
    startDate: string
    moved: boolean
  } | null>(null)

  useEffect(() => {
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

  const columnAtX = (clientX: number): { date: string; el: HTMLElement } | null => {
    for (const date of days) {
      const el = columnsRef.current.get(date)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return { date, el }
    }
    return null
  }

  const openCreate = (date: string, start: number, end: number) => {
    const s = Math.min(start, end)
    const e = Math.max(start, end)
    if (e - s < SLOT) return
    setDraft({ date, start: s, end: e })
    setTitle('')
    setProjectId('chase')
    setStartMinutes(s)
    setEndMinutes(e)
    setEditing(null)
    setCreatePreview(null)
  }

  const openEdit = (block: CalendarBlock) => {
    setEditing(block)
    setTitle(block.title)
    setProjectId(block.projectId || '')
    setStartMinutes(block.startMinutes)
    setEndMinutes(block.endMinutes)
    setDraft(null)
    setCreatePreview(null)
  }

  const closeModal = () => {
    setDraft(null)
    setEditing(null)
    setCreatePreview(null)
  }

  const saveBlock = () => {
    const trimmed = title.trim() || 'Untitled block'
    let start = snap(startMinutes)
    let end = snap(endMinutes)
    if (end <= start) end = Math.min(DAY_END, start + SLOT)
    if (end <= start) start = Math.max(DAY_START, end - SLOT)

    if (editing) {
      store.updateCalendarBlock(editing.id, {
        title: trimmed,
        projectId: projectId || undefined,
        startMinutes: start,
        endMinutes: end,
      })
      setEditing(null)
      return
    }
    if (!draft) return
    store.addCalendarBlock({
      title: trimmed,
      date: draft.date,
      startMinutes: start,
      endMinutes: end,
      projectId: projectId || undefined,
    })
    setDraft(null)
  }

  const onStartChange = (value: number) => {
    const next = snap(value)
    setStartMinutes(next)
    if (endMinutes <= next) {
      setEndMinutes(Math.min(DAY_END, next + SLOT))
    }
  }

  const onEndChange = (value: number) => {
    const next = snap(value)
    setEndMinutes(next)
    if (next <= startMinutes) {
      setStartMinutes(Math.max(DAY_START, next - SLOT))
    }
  }

  const beginCreateDrag = (date: string, col: HTMLElement, clientY: number) => {
    const start = yToMinutes(clientY, col)
    createDrag.current = { date, origin: start }
    setCreatePreview({ date, start, end: start + 30 })
    setDraft(null)
    setEditing(null)

    const onMove = (ev: MouseEvent) => {
      if (!createDrag.current) return
      const end = yToMinutes(ev.clientY, col)
      setCreatePreview({
        date: createDrag.current.date,
        start: createDrag.current.origin,
        end: end === createDrag.current.origin ? end + 30 : end,
      })
    }

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!createDrag.current) return
      const end = yToMinutes(ev.clientY, col)
      const origin = createDrag.current.origin
      const finalEnd = Math.abs(end - origin) < SLOT ? origin + 60 : end
      const dateKey = createDrag.current.date
      createDrag.current = null
      setCreatePreview(null)
      openCreate(dateKey, origin, finalEnd)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const beginMoveDrag = (
    block: CalendarBlock,
    col: HTMLElement,
    clientY: number,
    e: ReactMouseEvent,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const grabMins = yToMinutes(clientY, col)
    const grabOffsetMins = grabMins - block.startMinutes
    const duration = block.endMinutes - block.startMinutes
    const previewRef: { current: RangeDraft & { id: string } } = {
      current: {
        id: block.id,
        date: block.date,
        start: block.startMinutes,
        end: block.endMinutes,
      },
    }

    moveDrag.current = {
      id: block.id,
      duration,
      grabOffsetMins,
      startDate: block.date,
      moved: false,
    }
    setMovePreview(previewRef.current)

    const onMove = (ev: MouseEvent) => {
      const drag = moveDrag.current
      if (!drag) return
      const hit = columnAtX(ev.clientX) ?? { date: drag.startDate, el: col }
      const pointerMins = yToMinutes(ev.clientY, hit.el)
      let start = snap(pointerMins - drag.grabOffsetMins)
      start = clamp(start, DAY_START, DAY_END - drag.duration)
      const end = start + drag.duration
      if (
        start !== block.startMinutes ||
        end !== block.endMinutes ||
        hit.date !== block.date
      ) {
        drag.moved = true
      }
      previewRef.current = { id: drag.id, date: hit.date, start, end }
      setMovePreview(previewRef.current)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const drag = moveDrag.current
      moveDrag.current = null
      const final = previewRef.current
      setMovePreview(null)
      if (drag?.moved) {
        store.updateCalendarBlock(drag.id, {
          date: final.date,
          startMinutes: final.start,
          endMinutes: final.end,
        })
      } else {
        openEdit(block)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const blocksFor = (date: string) =>
    store.state.calendarBlocks.filter((b) => {
      if (movePreview?.id === b.id) return movePreview.date === date
      return b.date === date
    })

  const ghostFor = (date: string): RangeDraft | null => {
    if (createPreview?.date === date) return createPreview
    if (draft && !editing && draft.date === date) return draft
    return null
  }

  const modalOpen = Boolean(draft || editing)

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
              ref={(el) => {
                if (el) columnsRef.current.set(date, el)
                else columnsRef.current.delete(date)
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest('.cal-block')) return
                if (e.button !== 0) return
                beginCreateDrag(date, e.currentTarget, e.clientY)
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
                  : block.color || '#c9b896'
                const live =
                  movePreview?.id === block.id
                    ? movePreview
                    : { start: block.startMinutes, end: block.endMinutes }
                const top = (live.start - DAY_START) * PX_PER_MIN
                const height = Math.max(24, (live.end - live.start) * PX_PER_MIN)
                const moving = movePreview?.id === block.id
                return (
                  <div
                    key={block.id}
                    className={`cal-block${moving ? ' moving' : ''}`}
                    style={{
                      top,
                      height,
                      borderColor: color,
                      background: `${color}18`,
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return
                      beginMoveDrag(block, e.currentTarget.parentElement as HTMLElement, e.clientY, e)
                    }}
                  >
                    <p className="title">{block.title}</p>
                    <div className="time">
                      {minutesToTimeLabel(live.start)} – {minutesToTimeLabel(live.end)}
                    </div>
                  </div>
                )
              })}

              {(() => {
                const ghost = ghostFor(date)
                if (!ghost) return null
                return (
                  <div
                    className="drag-preview"
                    style={{
                      top: (Math.min(ghost.start, ghost.end) - DAY_START) * PX_PER_MIN,
                      height: Math.max(
                        20,
                        Math.abs(ghost.end - ghost.start) * PX_PER_MIN,
                      ),
                    }}
                  />
                )
              })()}
            </div>
          ))}
        </div>

        <p className="three-day-hint">
          DRAG empty space to create · DRAG a block to move · CLICK a block to edit
        </p>
      </HudPanel>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
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
                  background: projectId ? PROJECT_MAP[projectId].color : '#c9b896',
                  color: projectId ? PROJECT_MAP[projectId].color : '#c9b896',
                }}
              />
              {editing ? 'EDIT BLOCK' : 'NEW BLOCK'}
            </h2>
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
            <div className="time-fields">
              <label>
                START
                <select
                  value={startMinutes}
                  onChange={(e) => onStartChange(Number(e.target.value))}
                  aria-label="Start time"
                >
                  {TIME_OPTIONS.filter((m) => m < DAY_END).map((m) => (
                    <option key={m} value={m}>
                      {minutesToTimeLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                FINISH
                <select
                  value={endMinutes}
                  onChange={(e) => onEndChange(Number(e.target.value))}
                  aria-label="Finish time"
                >
                  {TIME_OPTIONS.filter((m) => m > DAY_START).map((m) => (
                    <option key={m} value={m}>
                      {minutesToTimeLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field-label">PROJECT</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value as ProjectId | '')}
              className="field-select"
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
              <button className="btn-secondary" type="button" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
