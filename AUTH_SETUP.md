# Clerk + Supabase setup (Personal OS)

## Vercel env vars

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://gfpcdwjdxtgypizlzbkq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Redeploy after saving.

## Clerk dashboard

1. **Paths** — Home / after sign-in / after sign-out → `https://personal-os-ecomos1.vercel.app`
2. **Domains** — allow that production URL (+ `http://localhost:3000` for local)
3. **[Supabase integration](https://dashboard.clerk.com/setup/supabase)** — Activate → copy **Clerk domain**

## Supabase dashboard

1. **SQL Editor** — run these migrations (in order):
   - `supabase/migrations/20260728140000_user_app_state.sql`
   - `supabase/migrations/20260728150000_company_todos.sql` (Batcave to-dos + dependencies)
2. **Authentication → Sign In / Third-party** — Add **Clerk** → paste Clerk domain

## What the app does

- Middleware requires Clerk sign-in for the UI
- After login: **layer gate** → Enter Batcave (company) or Enter Command Center (personal)
- **Command Center** — dashboard, deep work, personal finances
- **Batcave** — company to-dos (HPA + blockers), company finance (existing Revolut/buckets), plus coming-soon tabs
- Full personal/company finance app state syncs to `user_app_state` keyed by your Clerk user id:
  deep work, tasks, habits, calendar, identity, personal + company finances,
  Revolut account selections / queues, and Revolut app secret + refresh token
- Company to-dos live in `company_tasks` + `company_task_dependencies` (RLS per Clerk user)
- On sign-in, richer browser data wins over an empty/thin cloud row (then uploads)
- Header **Upload → cloud** force-pushes this browser’s data under your account
- localStorage remains a cache; cloud is the cross-device source of truth
