import type { AppState, Project, Task } from '../types'

export const PROJECTS: Project[] = [
  { id: 'chase', name: 'Chase Build', color: '#5b8def' },
  { id: 'myProject', name: 'My Project', color: '#3d9b7a' },
  { id: 'rav', name: 'Rav Work', color: '#c4922a' },
  { id: 'personal', name: 'Personal Time', color: '#8b7ec8' },
]

export const PROJECT_MAP = Object.fromEntries(PROJECTS.map((p) => [p.id, p])) as Record<
  Project['id'],
  Project
>

/** Anchor date from screenshots: Wednesday 22 Jul 2026 */
export const ANCHOR_DATE = '2026-07-22'

let idCounter = 0
export function uid(prefix = 'id') {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

function task(text: string, forToday: boolean, done = false): Task {
  return { id: uid('task'), text, done, forToday }
}

export function createSeedState(): AppState {
  return {
    selectedDate: ANCHOR_DATE,
    identityTitle: 'WHO I AM FOR THE NEXT 90 DAYS',
    identityQuestion: 'Constant Question: Is This A Decision From An Evolved Identity?',
    identityBody:
      'Retard max. Detach from outcomes. Operate from the man I am becoming — not the habits, fears, or noise of who I used to be. Every choice either compounds the evolved identity or leaks energy back into the old one. Become irreversible.',
    weekIntention:
      'Nicotine Taper Plan (Delay Pouch 1 By 1-4 Hours) T4, W3, T2, F2, S1, S1, M0. Become irreversible. Compound. Be intentional & disciplined. I am the man who thrives in imperfect conditions. Allocate minimum 3 hours per day to my project.',
    openLoops: [
      { id: uid('loop'), text: 'Dan Mentorship (Present Idea)', done: false },
      { id: uid('loop'), text: 'Sort 12-Month Visa', done: false },
      { id: uid('loop'), text: 'Ricky Ads Investment', done: false },
      { id: uid('loop'), text: 'Pay Ateet', done: false },
    ],
    reminders: [
      'Protect deep work.',
      'No phone during deep work.',
      'Retard max, stop over analysing.',
      'Excess importance creates unnecessary suffering.',
      'Have 0 fucks to give.',
    ],
    habits: [
      { id: uid('habit'), name: 'Train', done: true, streak: 3 },
      { id: uid('habit'), name: 'Sauna & Ice Bath', done: true, streak: 3 },
      { id: uid('habit'), name: 'Read / Audiobook', done: true, streak: 1 },
      { id: uid('habit'), name: 'Write', done: false, streak: 0 },
      { id: uid('habit'), name: 'Intermittent Fast', done: true, streak: 3 },
      { id: uid('habit'), name: 'Plan Tomorrow', done: false, streak: 0 },
    ],
    tasks: {
      chase: [
        task('Finalise phone setup section', true),
        task('Integrate candidate vs client backend + front end', true),
        task('Contacts list 1x (toggle)', true),
        task('Pipelines 2x', false),
        task('Calendar 1x', false),
        task('Candidate search filters polish', false),
        task('Onboarding email sequences', false),
      ],
      myProject: [
        task('Creative Generation Academy', true),
        task('Media Buyer Academy', true),
        task('Head Of Research Academy', false),
        task('Complete CEO Academy', false),
        task('Offer positioning rewrite', false),
      ],
      rav: [
        task('Add To Stripe', true),
        task('Invoice follow-up batch', false),
        task('Scope next deliverable', false),
      ],
      personal: [
        task('Deep Reflection', true),
        task('Fuck You List', false),
        task('Move Attention OS To Vercel', false),
        task('Mumma Bday Card', true),
        task('Apartment Deposit + Finances', false),
      ],
    },
    timeEntries: [
      { id: uid('te'), projectId: 'chase', date: '2026-07-20', minutes: 180 },
      { id: uid('te'), projectId: 'myProject', date: '2026-07-20', minutes: 60 },
      { id: uid('te'), projectId: 'chase', date: '2026-07-21', minutes: 90 },
      { id: uid('te'), projectId: 'myProject', date: '2026-07-21', minutes: 50 },
      { id: uid('te'), projectId: 'rav', date: '2026-07-21', minutes: 14 },
      { id: uid('te'), projectId: 'chase', date: '2026-07-22', minutes: 414 },
      { id: uid('te'), projectId: 'myProject', date: '2026-07-22', minutes: 87 },
      { id: uid('te'), projectId: 'rav', date: '2026-07-22', minutes: 28 },
      { id: uid('te'), projectId: 'personal', date: '2026-07-22', minutes: 48 },
    ],
    calendarBlocks: [
      {
        id: uid('block'),
        title: 'Chase — phone setup + pipelines',
        date: '2026-07-22',
        startMinutes: 9 * 60,
        endMinutes: 12 * 60,
        projectId: 'chase',
      },
      {
        id: uid('block'),
        title: 'My Project — Academy deep work',
        date: '2026-07-22',
        startMinutes: 13 * 60,
        endMinutes: 15 * 60 + 30,
        projectId: 'myProject',
      },
      {
        id: uid('block'),
        title: 'Rav — Stripe',
        date: '2026-07-22',
        startMinutes: 16 * 60,
        endMinutes: 16 * 60 + 30,
        projectId: 'rav',
      },
      {
        id: uid('block'),
        title: 'Chase — backend + contacts',
        date: '2026-07-21',
        startMinutes: 10 * 60,
        endMinutes: 12 * 60 + 30,
        projectId: 'chase',
      },
      {
        id: uid('block'),
        title: 'Deep reflection',
        date: '2026-07-23',
        startMinutes: 8 * 60,
        endMinutes: 9 * 60,
        projectId: 'personal',
      },
    ],
    activeTimer: null,
    summaryMode: 'day',
    calendarMonth: '2026-07',
    dailyDeepWorkTargetMinutes: 6 * 60, // 6h — aggressive, editable
    // Allocate the 6h bar: Chase 2h · My Project 3h · Rav 1h
    dailyDeepWorkSplit: {
      chase: 2 * 60,
      myProject: 3 * 60,
      rav: 1 * 60,
    },
    showAllTasks: false,
    dailyOneThing: {
      '2026-07-22': 'Ship Chase phone setup + pipelines to done',
      '2026-07-21': 'Clear Chase backend integration block',
      '2026-07-20': 'Protect 4h deep work — no phone',
    },
  }
}
