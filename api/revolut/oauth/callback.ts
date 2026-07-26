import type { VercelRequest, VercelResponse } from '@vercel/node'
import { exchangeAuthorizationCode, jsonError } from '../../_lib/revolut'

function firstQuery(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/**
 * One-time OAuth callback. Exchanges ?code= for tokens and shows the refresh
 * token so you can paste it into Vercel env as REVOLUT_REFRESH_TOKEN.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed')
  }

  const code = firstQuery(req.query.code)
  const error = firstQuery(req.query.error)

  if (error) {
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
      <h1>Revolut OAuth error</h1>
      <p>${escapeHtml(error)}</p>
    </body></html>`)
    return
  }

  if (!code) {
    return jsonError(res, 400, 'Missing authorization code.')
  }

  try {
    const tokens = await exchangeAuthorizationCode(code)
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem;max-width:720px">
      <h1>Revolut connected</h1>
      <p>Copy this refresh token into Vercel → Environment Variables as <code>REVOLUT_REFRESH_TOKEN</code>, then redeploy.</p>
      <textarea readonly style="width:100%;height:8rem;font-family:monospace">${escapeHtml(tokens.refresh_token)}</textarea>
      <p style="color:#666;margin-top:1.5rem">You can close this tab after saving the token. Do not share it.</p>
    </body></html>`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed'
    res.status(502).setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
      <h1>Token exchange failed</h1>
      <p>${escapeHtml(message)}</p>
    </body></html>`)
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
