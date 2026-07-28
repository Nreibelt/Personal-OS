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

## Deploy (Vercel) — if you see “No Next.js version detected”

1. **Settings → General → Framework Preset** → **Next.js**
2. **Root Directory** → click Edit → **clear it completely** (do **not** use `./` — leave blank) → Save
3. Build & Development Settings: all **Override** toggles **OFF**
4. Do **not** Redeploy an old failed deployment (it keeps Framework=Other). Instead:
   - Deployments → **Create Deployment** → branch `main` (or merge this PR)
   - Or push a new commit to `main`
5. On the new deploy details, confirm Framework = **Next.js**

Env vars: Clerk + Supabase (+ Revolut) — see `.env.example`

# Force Vercel to pick up current Next.js main
