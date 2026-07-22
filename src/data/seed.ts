import type { AppState, Project } from '../types'

export const PROJECTS: Project[] = [
  { id: 'chase', name: 'Chase Build', color: '#3b9eff', glow: 'rgba(59, 158, 255, 0.45)' },
  { id: 'myProject', name: 'My Project', color: '#2dd4a8', glow: 'rgba(45, 212, 168, 0.45)' },
  { id: 'rav', name: 'Rav Work', color: '#f0a202', glow: 'rgba(240, 162, 2, 0.45)' },
  { id: 'personal', name: 'Personal Time', color: '#a78bfa', glow: 'rgba(167, 139, 250, 0.45)' },
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
        { id: uid('task'), text: 'Finalise phone setup section', done: false },
        { id: uid('task'), text: 'Integrate candidate vs client backend + front end', done: false },
        { id: uid('task'), text: 'Contacts list 1x (toggle)', done: false },
        { id: uid('task'), text: 'Pipelines 2x', done: false },
        { id: uid('task'), text: 'Calendar 1x', done: false },
      ],
      myProject: [
        { id: uid('task'), text: 'Creative Generation Academy', done: false },
        { id: uid('task'), text: 'Media Buyer Academy', done: false },
        { id: uid('task'), text: 'Head Of Research Academy', done: false },
        { id: uid('task'), text: 'Complete CEO Academy', done: false },
      ],
      rav: [{ id: uid('task'), text: 'Add To Stripe', done: false }],
      personal: [
        { id: uid('task'), text: 'Deep Reflection', done: false },
        { id: uid('task'), text: 'Fuck You List', done: false },
        { id: uid('task'), text: 'Move Attention OS To Vercel', done: false },
        { id: uid('task'), text: 'Mumma Bday Card', done: false },
        { id: uid('task'), text: 'Apartment Deposit + Finances', done: false },
      ],
    },
    // Seeded from screenshots so Day / Week / Total + calendar match
    timeEntries: [
      // Mon 20 Jul — ~4h deep work
      { id: uid('te'), projectId: 'chase', date: '2026-07-20', minutes: 180 },
      { id: uid('te'), projectId: 'myProject', date: '2026-07-20', minutes: 60 },
      // Tue 21 Jul — 2h 34m
      { id: uid('te'), projectId: 'chase', date: '2026-07-21', minutes: 90 },
      { id: uid('te'), projectId: 'myProject', date: '2026-07-21', minutes: 50 },
      { id: uid('te'), projectId: 'rav', date: '2026-07-21', minutes: 14 },
      // Wed 22 Jul — 8h 49m deep + 48m personal
      { id: uid('te'), projectId: 'chase', date: '2026-07-22', minutes: 414 },
      { id: uid('te'), projectId: 'myProject', date: '2026-07-22', minutes: 87 },
      { id: uid('te'), projectId: 'rav', date: '2026-07-22', minutes: 28 },
      { id: uid('te'), projectId: 'personal', date: '2026-07-22', minutes: 48 },
      // Prior backlog to hit ~16h 11m all-time (remaining after above)
      // Current sum: 180+60+90+50+14+414+87+28+48 = 971 ✓ (16h 11m)
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
  }
}
