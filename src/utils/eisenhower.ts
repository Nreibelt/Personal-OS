import type { EisenhowerQuadrant } from '../types'

export const EISENHOWER_META: Record<
  EisenhowerQuadrant,
  {
    label: string
    short: string
    hint: string
    className: string
    order: number
  }
> = {
  do: {
    label: 'Do first',
    short: 'Q1',
    hint: 'Urgent + Important',
    className: 'eq-do',
    order: 1,
  },
  schedule: {
    label: 'Schedule',
    short: 'Q2',
    hint: 'Important · Not urgent',
    className: 'eq-schedule',
    order: 2,
  },
  delegate: {
    label: 'Delegate',
    short: 'Q3',
    hint: 'Urgent · Not important',
    className: 'eq-delegate',
    order: 3,
  },
  eliminate: {
    label: 'Eliminate',
    short: 'Q4',
    hint: 'Neither',
    className: 'eq-eliminate',
    order: 4,
  },
}

export const EISENHOWER_ORDER: EisenhowerQuadrant[] = ['do', 'schedule', 'delegate', 'eliminate']

export const EISENHOWER_OPTIONS = EISENHOWER_ORDER.map((value) => ({
  value,
  label: `${EISENHOWER_META[value].label} — ${EISENHOWER_META[value].hint}`,
}))
