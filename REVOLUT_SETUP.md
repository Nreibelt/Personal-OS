# Revolut Business sync — Vercel setup

End-of-day sync pulls completed/pending transactions for selected Revolut Business accounts into Personal or Company Finances. You categorize outflows (or discard internals); incomings are shown for discard only.

## 1. Revolut Business prerequisites

- Revolut Business on **Grow** (or higher) — API is not on Basic
- Business API certificate in Revolut → Settings → APIs → Business API

Generate an RSA key pair locally:

```bash
openssl genrsa -out privatecert.pem 2048
openssl req -new -x509 -key privatecert.pem -out publiccert.cer -days 3650 \
  -subj "/CN=batcave-revolut/O=Batcave/C=GB"
```

In Revolut Business API settings:

1. Upload `publiccert.cer`
2. Set **OAuth redirect URI** to:  
   `https://YOUR_VERCEL_DOMAIN/api/revolut/oauth/callback`
3. Copy the **Client ID**
4. Note the JWT **iss** (usually the host of the redirect URI, e.g. `your-app.vercel.app`)
5. Enable scope **READ** only (enough for accounts + transactions)

Keep `privatecert.pem` secret. Never commit it.

## 2. Vercel environment variables

Project → Settings → Environment Variables (Production + Preview):

| Name | Value |
|------|--------|
| `REVOLUT_ENV` | `production` (or `sandbox` while testing) |
| `REVOLUT_CLIENT_ID` | Client ID from Revolut |
| `REVOLUT_PRIVATE_KEY` | Full PEM from `privatecert.pem` (paste with real newlines, or a single line using `\n`) |
| `REVOLUT_REDIRECT_URI` | `https://YOUR_VERCEL_DOMAIN/api/revolut/oauth/callback` |
| `REVOLUT_JWT_ISS` | Redirect host, e.g. `your-app.vercel.app` |
| `REVOLUT_APP_SECRET` | Long random string you invent (e.g. `openssl rand -hex 32`) |
| `REVOLUT_REFRESH_TOKEN` | Filled in after step 3 |

Redeploy after saving env vars.

## 3. One-time OAuth (get refresh token)

1. Deploy with the vars above (refresh token optional at first).
2. Visit: `https://YOUR_VERCEL_DOMAIN/api/revolut/oauth/start`
3. Approve access in Revolut (READ only)
4. Callback page **auto-saves** the refresh token in this browser and shows it
5. Optional backup: also set `REVOLUT_REFRESH_TOKEN` in Vercel and redeploy

If you see “token expired / invalid”, click **Reconnect Revolut** in the app (or visit `/api/revolut/oauth/start` again). Revolut often rotates refresh tokens; the app now stores the latest one in the browser and keeps it updated when Revolut rotates.

## 4. In the app

1. Open **Personal Finances** or **Company Finances**
2. In **Revolut Sync**, paste the same `REVOLUT_APP_SECRET` and Save (stored in this browser only)
3. Tick the accounts for that realm (personal vs company can differ)
4. Pick a day → **Sync day**
5. For each outflow: pick a set-expense category (or Unexpected) → **Add**, or **Discard**
6. Incomings: **Discard** when you’ve acknowledged them

Local dev: run `npx vercel dev` so `/api/*` routes work (plain `vite` alone will not).

## Security notes

- Revolut private key + refresh token stay on Vercel only
- `REVOLUT_APP_SECRET` gates your API routes; anyone with it can read your business transactions via your app
- Prefer READ scope only — do not enable PAY unless you need it
