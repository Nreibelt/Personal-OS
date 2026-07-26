import { exchangeAuthorizationCode } from '../../_lib/revolut.js'

function firstQuery(value) {
  if (Array.isArray(value)) return value[0]
  return value
}

function html(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(body)
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * One-time OAuth callback. Exchanges ?code= for tokens and shows the refresh
 * token so you can paste it into Vercel as REVOLUT_REFRESH_TOKEN.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return html(res, 405, '<h1>Method not allowed</h1>')
    }

    const code = firstQuery(req.query.code)
    const error = firstQuery(req.query.error)

    if (error) {
      return html(
        res,
        400,
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h1>Revolut OAuth error</h1>
          <p>${escapeHtml(error)}</p>
        </body></html>`,
      )
    }

    if (!code) {
      return html(
        res,
        400,
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h1>Missing authorization code</h1>
          <p>Go back to Revolut and click Enable access again.</p>
        </body></html>`,
      )
    }

    const tokens = await exchangeAuthorizationCode(code)
    return html(
      res,
      200,
      `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;max-width:720px">
        <h1>Revolut connected</h1>
        <p>Copy this refresh token into Vercel → Environment Variables as <code>REVOLUT_REFRESH_TOKEN</code>, then redeploy.</p>
        <textarea readonly style="width:100%;height:8rem;font-family:monospace">${escapeHtml(tokens.refresh_token)}</textarea>
        <p style="color:#666;margin-top:1.5rem">You can close this tab after saving the token. Do not share it.</p>
      </body></html>`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed'
    console.error('revolut oauth callback failed', err)
    return html(
      res,
      500,
      `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;max-width:720px">
        <h1>Token exchange failed</h1>
        <p>${escapeHtml(message)}</p>
        <p>Common fixes:</p>
        <ul>
          <li>Confirm <code>REVOLUT_CLIENT_ID</code>, <code>REVOLUT_PRIVATE_KEY</code>, <code>REVOLUT_JWT_ISS</code>, <code>REVOLUT_REDIRECT_URI</code> are set on Vercel</li>
          <li>Private key must match the certificate uploaded to Revolut</li>
          <li>Auth codes expire in ~2 minutes — click Enable access again</li>
        </ul>
      </body></html>`,
    )
  }
}
