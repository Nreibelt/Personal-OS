import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { PROJECT_MAP, PROJECTS } from '../data/seed'
import type { CalendarBlock, ProjectId } from '../types'
import type { Store } from '../hooks/useStore'
import {
  addDays,
  clamp,
  formatDayLabel,
  formatMinutes,
  minutesToTimeLabel,
  nowMinutesInAppTz,
  pad2,
  parseDateKey,
  todayDateKey,
  weekDays,
} from '../utils/time'
import {
  blocksOnDate,
  dayOfWeek,
  describeRepeat,
  layoutDayBlocks,
} from '../utils/recurrence'
import { HudPanel } from './HudPanel'
import { ModalPortal } from './ui/ModalPortal'

const DAY_START = 0
const DAY_END = 24 * 60
const PX_PER_MIN = 1.05
const HEIGHT = (DAY_END - DAY_START) * PX_PER_MIN
const SLOT = 15
const BODY_HEIGHT = 560
const DEFAULT_COLOR = '#c9b896'

/** Monday-first weekday pickers: label + JS day index (0 = Sun). */
const DAY_PICKS: { label: string; dow: number }[] = [
  { label: 'M', dow: 1 },
  { label: 'T', dow: 2 },
  { label: 'W', dow: 3 },
  { label: 'T', dow: 4 },
  { label: 'F', dow: 5 },
  { label: 'S', dow: 6 },
  { label: 'S', dow: 0 },
]

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]

type Span = 1 | 3 | 7
type RangeDraft = { date: string; start: number; end: number }
type EditScope = 'one' | 'all'
type DragPreview = RangeDraft & { id: string; sourceDate: string }
type PendingChange = {
  block: CalendarBlock
  occurrenceDate: string
  patch: { date: string; startMinutes: number; endMinutes: number }
}

function snap(mins: number, step = SLOT) {
  return Math.round(mins / step) * step
}

function minutesToHHMM(mins: number) {
  const m = clamp(mins, 0, 24 * 60 - 1)
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

function hhmmToMinutes(value: string, fallback: number) {
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback
  return h * 60 + m
}

function sameDays(a: number[], b: number[]) {
  return a.length === b.length && b.every((d) => a.includes(d))
}

export function ScheduleCalendar({ store }: { store: Store }) {
  const center = store.state.selectedDate
  const today = todayDateKey()
  const [span, setSpan] = useState<Span>(3)

  const days = useMemo(() => {
    if (span === 1) return [center]
    if (span === 7) return weekDays(center)
    return [addDays(center, -1), center, addDays(center, 1)]
  }, [center, span])

  const scrollRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<Map<string, HTMLElement>>(new Map())

  // Re-render every 30s so the "now" line tracks the clock
  const [, setNowTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const nowMinutes = nowMinutesInAppTz()

  // ——— Modal state ———
  const [draft, setDraft] = useState<RangeDraft | null>(null)
  const [createPreview, setCreatePreview] = useState<RangeDraft | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)

  const [editing, setEditing] = useState<{ block: CalendarBlock; date: string } | null>(null)
  const [scope, setScope] = useState<EditScope>('one')
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<ProjectId | ''>('chase')
  const [startMinutes, setStartMinutes] = useState(9 * 60)
  const [endMinutes, setEndMinutes] = useState(10 * 60)
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [repeatUntil, setRepeatUntil] = useState('')

  const createDrag = useRef<{ date: string; origin: number } | null>(null)
  const blockDrag = useRef<{
    id: string
    mode: 'move' | 'resize'
    duration: number
    grabOffsetMins: number
    startDate: string
    moved: boolean
  } | null>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (7 * 60 - DAY_START) * PX_PER_MIN - 8
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

  // ——— Open / close modal ———

  const openCreate = (date: string, start: number, end: number) => {
    const s = Math.min(start, end)
    const e = Math.max(start, end)
    if (e - s < SLOT) return
    setDraft({ date, start: s, end: e })
    setTitle('')
    setProjectId('chase')
    setStartMinutes(s)
    setEndMinutes(e)
    setRepeatDays([])
    setRepeatUntil('')
    setEditing(null)
    setCreatePreview(null)
  }

  const openEdit = (block: CalendarBlock, date: string) => {
    setEditing({ block, date })
    setScope(block.repeat ? 'one' : 'all')
    setTitle(block.title)
    setProjectId(block.projectId || '')
    setStartMinutes(block.startMinutes)
    setEndMinutes(block.endMinutes)
    setRepeatDays(block.repeat ? [...block.repeat.days] : [])
    setRepeatUntil(block.repeat?.until || '')
    setDraft(null)
    setCreatePreview(null)
  }

  const closeModal = () => {
    setDraft(null)
    setEditing(null)
    setCreatePreview(null)
  }

  const modalOpen = Boolean(draft || editing)

  useEffect(() => {
    if (!modalOpen && !pendingChange) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal()
        setPendingChange(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, pendingChange])

  // ——— Save / delete ———

  const buildRepeat = () => {
    if (repeatDays.length === 0) return undefined
    return {
      days: [...new Set(repeatDays)].sort((a, b) => a - b),
      until: repeatUntil || undefined,
    }
  }

  const saveBlock = () => {
    const trimmed = title.trim() || 'Untitled block'
    let start = startMinutes
    let end = endMinutes
    if (end <= start) end = Math.min(DAY_END, start + SLOT)
    if (end <= start) start = Math.max(DAY_START, end - SLOT)

    if (editing) {
      const { block, date } = editing
      if (block.repeat && scope === 'one') {
        store.detachBlockOccurrence(block.id, date, {
          title: trimmed,
          projectId: projectId || undefined,
          startMinutes: start,
          endMinutes: end,
        })
      } else {
        const repeat = buildRepeat()
        store.updateCalendarBlock(block.id, {
          title: trimmed,
          projectId: projectId || undefined,
          startMinutes: start,
          endMinutes: end,
          repeat,
          // If the series was turned off, keep the event on the day being viewed
          date: block.repeat && !repeat ? date : block.date,
          skipDates: repeat ? block.skipDates : undefined,
        })
      }
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
      repeat: buildRepeat(),
    })
    setDraft(null)
  }

  const deleteBlock = () => {
    if (!editing) return
    const { block, date } = editing
    if (block.repeat && scope === 'one') {
      store.skipBlockOccurrence(block.id, date)
    } else {
      store.removeCalendarBlock(block.id)
    }
    setEditing(null)
  }

  // ——— Time field handlers ———

  const onStartChange = (value: string) => {
    const next = hhmmToMinutes(value, startMinutes)
    setStartMinutes(next)
    if (endMinutes <= next) setEndMinutes(Math.min(DAY_END, next + 60))
  }

  const onEndChange = (value: string) => {
    const next = hhmmToMinutes(value, endMinutes)
    setEndMinutes(next)
    if (next <= startMinutes) setStartMinutes(Math.max(DAY_START, next - 60))
  }

  // ——— Repeat picker ———

  const repeatPreset = useMemo(() => {
    if (repeatDays.length === 0) return 'none'
    if (repeatDays.length === 7) return 'daily'
    if (sameDays(repeatDays, WEEKDAYS)) return 'weekdays'
    return 'custom'
  }, [repeatDays])

  const anchorDate = editing?.block.date ?? draft?.date ?? center

  const applyPreset = (preset: 'none' | 'daily' | 'weekdays' | 'custom') => {
    if (preset === 'none') setRepeatDays([])
    else if (preset === 'daily') setRepeatDays(ALL_DAYS)
    else if (preset === 'weekdays') setRepeatDays(WEEKDAYS)
    else setRepeatDays((d) => (d.length > 0 ? d : [dayOfWeek(anchorDate)]))
    if (preset === 'none') setRepeatUntil('')
  }

  const toggleRepeatDay = (dow: number) => {
    setRepeatDays((d) => (d.includes(dow) ? d.filter((x) => x !== dow) : [...d, dow]))
  }

  // ——— Create by dragging on empty space ———

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

  // ——— Move / resize existing blocks ———

  const commitBlockChange = (block: CalendarBlock, occurrenceDate: string, patch: PendingChange['patch']) => {
    if (block.repeat) {
      setPendingChange({ block, occurrenceDate, patch })
    } else {
      store.updateCalendarBlock(block.id, patch)
    }
  }

  const beginBlockDrag = (
    block: CalendarBlock,
    occurrenceDate: string,
    mode: 'move' | 'resize',
    col: HTMLElement,
    e: ReactMouseEvent,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const grabMins = yToMinutes(e.clientY, col)
    const duration = block.endMinutes - block.startMinutes
    const previewRef: { current: DragPreview } = {
      current: {
        id: block.id,
        date: occurrenceDate,
        sourceDate: occurrenceDate,
        start: block.startMinutes,
        end: block.endMinutes,
      },
    }

    blockDrag.current = {
      id: block.id,
      mode,
      duration,
      grabOffsetMins: grabMins - block.startMinutes,
      startDate: occurrenceDate,
      moved: false,
    }
    setDragPreview(previewRef.current)

    const onMove = (ev: MouseEvent) => {
      const drag = blockDrag.current
      if (!drag) return
      if (drag.mode === 'resize') {
        const pointerMins = yToMinutes(ev.clientY, col)
        const end = clamp(pointerMins, block.startMinutes + SLOT, DAY_END)
        if (end !== block.endMinutes) drag.moved = true
        previewRef.current = {
          id: drag.id,
          date: occurrenceDate,
          sourceDate: occurrenceDate,
          start: block.startMinutes,
          end,
        }
      } else {
        const hit = columnAtX(ev.clientX) ?? { date: drag.startDate, el: col }
        const pointerMins = yToMinutes(ev.clientY, hit.el)
        let start = snap(pointerMins - drag.grabOffsetMins)
        start = clamp(start, DAY_START, DAY_END - drag.duration)
        const end = start + drag.duration
        if (start !== block.startMinutes || end !== block.endMinutes || hit.date !== occurrenceDate) {
          drag.moved = true
        }
        previewRef.current = {
          id: drag.id,
          date: hit.date,
          sourceDate: occurrenceDate,
          start,
          end,
        }
      }
      setDragPreview(previewRef.current)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const drag = blockDrag.current
      blockDrag.current = null
      const final = previewRef.current
      setDragPreview(null)
      if (drag?.moved) {
        commitBlockChange(block, occurrenceDate, {
          date: final.date,
          startMinutes: final.start,
          endMinutes: final.end,
        })
      } else if (drag?.mode === 'move') {
        openEdit(block, occurrenceDate)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ——— Per-day render data ———

  const blocksFor = (date: string): CalendarBlock[] => {
    let list = blocksOnDate(store.state.calendarBlocks, date)
    if (dragPreview && dragPreview.date !== dragPreview.sourceDate) {
      if (date === dragPreview.sourceDate) {
        list = list.filter((b) => b.id !== dragPreview.id)
      } else if (date === dragPreview.date) {
        const src = store.state.calendarBlocks.find((b) => b.id === dragPreview.id)
        if (src && !list.some((b) => b.id === src.id)) list = [...list, src]
      }
    }
    return list
  }

  const ghostFor = (date: string): RangeDraft | null => {
    if (createPreview?.date === date) return createPreview
    if (draft && !editing && draft.date === date) return draft
    return null
  }

  const resolvePendingChange = (applyTo: EditScope) => {
    if (!pendingChange) return
    const { block, occurrenceDate, patch } = pendingChange
    if (applyTo === 'one') {
      store.detachBlockOccurrence(block.id, occurrenceDate, patch)
    } else {
      store.updateCalendarBlock(block.id, {
        startMinutes: patch.startMinutes,
        endMinutes: patch.endMinutes,
      })
    }
    setPendingChange(null)
  }

  const gridColumns = `54px repeat(${days.length}, 1fr)`
  const duration = Math.max(0, endMinutes - startMinutes)
  const pendingDateChanged = pendingChange
    ? pendingChange.patch.date !== pendingChange.occurrenceDate
    : false

  return (
    <>
      <HudPanel
        label="SCHEDULE"
        action={
          <div className="sched-toolbar">
            <div className="sched-span" role="group" aria-label="View span">
              {([1, 3, 7] as Span[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`sched-span-btn${span === s ? ' active' : ''}`}
                  onClick={() => setSpan(s)}
                >
                  {s === 1 ? 'Day' : s === 3 ? '3-Day' : 'Week'}
                </button>
              ))}
            </div>
            <div className="month-nav">
              <button
                className="ghost-btn"
                type="button"
                aria-label="Back"
                onClick={() => store.setSelectedDate(addDays(center, -span))}
              >
                ‹
              </button>
              <button
                className={`ghost-btn${days.includes(today) ? ' active' : ''}`}
                type="button"
                onClick={() => store.setSelectedDate(today)}
              >
                Today
              </button>
              <button
                className="ghost-btn"
                type="button"
                aria-label="Forward"
                onClick={() => store.setSelectedDate(addDays(center, span))}
              >
                ›
              </button>
            </div>
          </div>
        }
        className="sched"
      >
        <div className="sched-header" style={{ gridTemplateColumns: gridColumns }}>
          <div />
          {days.map((d) => {
            const { dow, day } = formatDayLabel(d)
            const isToday = d === today
            const active = d === center
            const month = parseDateKey(d).toLocaleString('en', { month: 'short' })
            return (
              <button
                key={d}
                type="button"
                className={`sched-col-head${active ? ' active' : ''}${isToday ? ' today' : ''}`}
                onClick={() => store.setSelectedDate(d)}
              >
                <span className="dow">{dow.toUpperCase()}</span>
                <span className="date">
                  {day} {month.toUpperCase()}
                </span>
                {isToday && <span className="today-pill">TODAY</span>}
              </button>
            )
          })}
        </div>

        <div
          className="sched-body"
          ref={scrollRef}
          style={{ height: Math.min(BODY_HEIGHT, HEIGHT), gridTemplateColumns: gridColumns }}
        >
          <div className="time-gutter" style={{ height: HEIGHT }}>
            {hours.map((m) =>
              m === DAY_START || m === DAY_END ? null : (
                <div key={m} className="time-label" style={{ top: (m - DAY_START) * PX_PER_MIN }}>
                  {minutesToTimeLabel(m)}
                </div>
              ),
            )}
          </div>

          {days.map((date) => {
            const dayBlocks = blocksFor(date)
            const layout = layoutDayBlocks(
              dayBlocks,
              dragPreview?.date === date
                ? { id: dragPreview.id, start: dragPreview.start, end: dragPreview.end }
                : null,
            )
            return (
              <div
                key={date}
                className={`day-column${date === today ? ' today' : ''}`}
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
                  <div key={m} className="hour-line" style={{ top: (m - DAY_START) * PX_PER_MIN }} />
                ))}

                {date === today && (
                  <div className="now-line" style={{ top: (nowMinutes - DAY_START) * PX_PER_MIN }}>
                    <span className="now-dot" />
                  </div>
                )}

                {dayBlocks.map((block) => {
                  const color = block.projectId
                    ? PROJECT_MAP[block.projectId].color
                    : block.color || DEFAULT_COLOR
                  const isDragging = dragPreview?.id === block.id
                  const live =
                    isDragging && dragPreview
                      ? { start: dragPreview.start, end: dragPreview.end }
                      : { start: block.startMinutes, end: block.endMinutes }
                  const pos = layout.get(block.id) ?? { col: 0, cols: 1 }
                  const top = (live.start - DAY_START) * PX_PER_MIN
                  const height = Math.max(22, (live.end - live.start) * PX_PER_MIN)
                  const width = 100 / pos.cols
                  return (
                    <div
                      key={block.id}
                      className={`cal-block${isDragging ? ' moving' : ''}${block.repeat ? ' repeating' : ''}`}
                      style={{
                        top,
                        height,
                        left: `calc(${pos.col * width}% + 2px)`,
                        width: `calc(${width}% - 5px)`,
                        borderColor: color,
                        background: `linear-gradient(180deg, ${color}26, ${color}14)`,
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return
                        if ((e.target as HTMLElement).closest('.cal-block-resize')) return
                        beginBlockDrag(
                          block,
                          date,
                          'move',
                          e.currentTarget.parentElement as HTMLElement,
                          e,
                        )
                      }}
                    >
                      <p className="title">
                        {block.repeat && (
                          <span className="repeat-badge" title={describeRepeat(block.repeat)}>
                            ⟳
                          </span>
                        )}
                        {block.title}
                      </p>
                      <div className="time">
                        {minutesToTimeLabel(live.start)} – {minutesToTimeLabel(live.end)}
                        {height > 46 && (
                          <span className="dur"> · {formatMinutes(live.end - live.start)}</span>
                        )}
                      </div>
                      <div
                        className="cal-block-resize"
                        onMouseDown={(e) => {
                          if (e.button !== 0) return
                          beginBlockDrag(
                            block,
                            date,
                            'resize',
                            (e.currentTarget.parentElement as HTMLElement)
                              .parentElement as HTMLElement,
                            e,
                          )
                        }}
                      />
                    </div>
                  )
                })}

                {(() => {
                  const ghost = ghostFor(date)
                  if (!ghost) return null
                  const gs = Math.min(ghost.start, ghost.end)
                  const ge = Math.max(ghost.start, ghost.end)
                  return (
                    <div
                      className="drag-preview"
                      style={{
                        top: (gs - DAY_START) * PX_PER_MIN,
                        height: Math.max(20, (ge - gs) * PX_PER_MIN),
                      }}
                    >
                      <span>
                        {minutesToTimeLabel(gs)} – {minutesToTimeLabel(ge)}
                      </span>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>

        <p className="sched-hint">
          DRAG empty space to create · DRAG a block to move · DRAG bottom edge to resize · CLICK to edit
        </p>
      </HudPanel>

      {modalOpen && (
        <ModalPortal>
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="modal sched-modal"
            role="dialog"
            aria-modal
            aria-labelledby="block-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="block-modal-title">
              <span
                className="dot"
                style={{
                  background: projectId ? PROJECT_MAP[projectId].color : DEFAULT_COLOR,
                  color: projectId ? PROJECT_MAP[projectId].color : DEFAULT_COLOR,
                }}
              />
              {editing ? 'EDIT BLOCK' : 'NEW BLOCK'}
            </h2>

            {editing?.block.repeat && (
              <div className="scope-toggle" role="group" aria-label="Apply changes to">
                <button
                  type="button"
                  className={scope === 'one' ? 'active' : ''}
                  onClick={() => setScope('one')}
                >
                  This event only
                </button>
                <button
                  type="button"
                  className={scope === 'all' ? 'active' : ''}
                  onClick={() => setScope('all')}
                >
                  All events
                </button>
              </div>
            )}

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
                <input
                  type="time"
                  step={900}
                  value={minutesToHHMM(startMinutes)}
                  onChange={(e) => onStartChange(e.target.value)}
                  aria-label="Start time"
                />
              </label>
              <label>
                FINISH
                <input
                  type="time"
                  step={900}
                  value={minutesToHHMM(Math.min(endMinutes, DAY_END - 1))}
                  onChange={(e) => onEndChange(e.target.value)}
                  aria-label="Finish time"
                />
              </label>
            </div>
            <p className="duration-note">{formatMinutes(duration)}</p>

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

            {editing?.block.repeat && scope === 'one' ? (
              <p className="repeat-note">
                Part of a series — {describeRepeat(editing.block.repeat)}. Changes apply to{' '}
                {editing.date} only.
              </p>
            ) : (
              <>
                <label className="field-label">REPEAT</label>
                <div className="repeat-presets" role="group" aria-label="Repeat">
                  {(
                    [
                      ['none', 'None'],
                      ['daily', 'Daily'],
                      ['weekdays', 'Weekdays'],
                      ['custom', 'Custom'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={repeatPreset === key ? 'active' : ''}
                      onClick={() => applyPreset(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {repeatDays.length > 0 && (
                  <>
                    <div className="repeat-days" role="group" aria-label="Repeat on days">
                      {DAY_PICKS.map(({ label, dow }, i) => (
                        <button
                          key={`${dow}-${i}`}
                          type="button"
                          className={repeatDays.includes(dow) ? 'active' : ''}
                          onClick={() => toggleRepeatDay(dow)}
                          aria-pressed={repeatDays.includes(dow)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="repeat-until">
                      <label>
                        ENDS (OPTIONAL)
                        <input
                          type="date"
                          value={repeatUntil}
                          min={anchorDate}
                          onChange={(e) => setRepeatUntil(e.target.value)}
                          aria-label="Repeat until"
                        />
                      </label>
                      {repeatUntil && (
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setRepeatUntil('')}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="repeat-note">{describeRepeat(buildRepeat())}</p>
                  </>
                )}
              </>
            )}

            <div className="btn-row">
              <button className="btn-primary" type="button" onClick={saveBlock}>
                {editing ? 'Save' : 'Add Block'}
              </button>
              {editing && (
                <button className="btn-secondary" type="button" onClick={deleteBlock}>
                  {editing.block.repeat && scope === 'one' ? 'Delete This Event' : 'Delete'}
                </button>
              )}
              <button className="btn-secondary" type="button" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {pendingChange && (
        <ModalPortal>
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingChange(null)}>
          <div
            className="modal sched-modal"
            role="dialog"
            aria-modal
            aria-labelledby="pending-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pending-modal-title">REPEATING EVENT</h2>
            <p>
              “{pendingChange.block.title}” repeats — {describeRepeat(pendingChange.block.repeat)}.
              {pendingDateChanged
                ? ' Moving it to another day only affects this occurrence.'
                : ' Apply the new time to:'}
            </p>
            <div className="btn-row">
              <button className="btn-primary" type="button" onClick={() => resolvePendingChange('one')}>
                This event only
              </button>
              {!pendingDateChanged && (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => resolvePendingChange('all')}
                >
                  All events
                </button>
              )}
              <button className="btn-secondary" type="button" onClick={() => setPendingChange(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  )
}
