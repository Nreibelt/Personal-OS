# Batcave — Deep Work

Sleek deep work command center: timers, daily targets, today/backlog tasks, and a 3-day calendar.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Two layers after login** — Command Center (personal) and Batcave (company), chosen from a gate screen
- **Command Center** — dashboard, deep work, personal finances
- **Batcave** — company to-dos (HPA tiers + blockers), company finance (Revolut + buckets), roadmap tabs (Meta Ads / Cold Email / Agents)
- **Daily deep work target** — set hours/day, see hit/miss, streak, and week hit rate
- **Today's One Thing** — single outcome to protect
- **Project tasks** — brain-dump backlog; default view shows only today's tasks; toggle **Show all tasks** to promote/demote with Today/Later
- Focus timers with session notes
- Identity, week intention, mental RAM, reminders, non-negotiables
- Time summary + attention allocation
- 3-day calendar (click-drag blocks) + monthly grid
- Seeded from Claude artifact screenshots (Jul 2026)
- Persists to `localStorage` + Supabase
- **Mentor** — Claude-powered pattern recognition across deep work, breaks, session debriefs, spend, journals, and Sunday logs

## Stack

Next.js (App Router) + React + TypeScript + Clerk + Supabase + Anthropic Claude API

## Auth + cloud data

See [AUTH_SETUP.md](./AUTH_SETUP.md) for Clerk + Supabase env vars and dashboard steps.

## Mentor (Claude API)

Claude Pro on claude.ai does **not** unlock the API. Create an API key at [console.anthropic.com](https://console.anthropic.com/), enable billing, and set `ANTHROPIC_API_KEY` in Vercel (and locally in `.env.local`).

After each deep-work session, a debrief prompt captures feeling + tags. Journal photos can be bulk-uploaded with dates; Claude Vision extracts text into the mentor loop. Use **Run full synthesis** for weapons / drags / blind spots / prescriptions.

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
