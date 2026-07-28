# Batcave — Deep Work

Sleek deep work command center: timers, daily targets, today/backlog tasks, and a 3-day calendar.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Daily deep work target** — set hours/day, see hit/miss, streak, and week hit rate
- **Today's One Thing** — single outcome to protect
- **Project tasks** — brain-dump backlog; default view shows only today's tasks; toggle **Show all tasks** to promote/demote with Today/Later
- Focus timers with session notes
- Identity, week intention, mental RAM, reminders, non-negotiables
- Time summary + attention allocation
- 3-day calendar (click-drag blocks) + monthly grid
- Seeded from Claude artifact screenshots (Jul 2026)
- Persists to `localStorage`

## Stack

Next.js (App Router) + React + TypeScript + Clerk + Supabase

## Auth + cloud data

See [AUTH_SETUP.md](./AUTH_SETUP.md) for Clerk + Supabase env vars and dashboard steps.

## Deploy (Vercel)

1. Set Framework Preset to **Next.js** (not Other / Vite)
2. Build command: `next build` (default)
3. Output: Next.js defaults (do not set a static `dist` output)
4. Env vars: Clerk + Supabase (+ existing Revolut vars) — see `.env.example`
5. Redeploy after merge
