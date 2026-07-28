import { NextRequest, NextResponse } from 'next/server'
import { exchangeAuthorizationCode } from '@/lib/revolut/client'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function html(status: number, body: string) {
  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

/**
 * OAuth callback. Exchanges ?code= for tokens, auto-saves refresh token in
 * localStorage for this origin, and shows it for optional Vercel backup.
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const error = req.nextUrl.searchParams.get('error')

    if (error) {
      return html(
        400,
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h1>Revolut OAuth error</h1>
          <p>${escapeHtml(error)}</p>
        </body></html>`,
      )
    }

    if (!code) {
      return html(
        400,
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h1>Missing authorization code</h1>
          <p>Go back to Revolut and click Enable access again.</p>
        </body></html>`,
      )
    }

    const tokens = await exchangeAuthorizationCode(code)
    const tokenJson = JSON.stringify(tokens.refresh_token)

    return html(
      200,
      `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;max-width:720px">
        <h1>Revolut connected</h1>
        <p><strong>Saved in this browser.</strong> You can close this tab and go back to Personal OS — sync should work now.</p>
        <p style="color:#666">Optional backup: also paste into Vercel as <code>REVOLUT_REFRESH_TOKEN</code> and redeploy.</p>
        <textarea readonly style="width:100%;height:8rem;font-family:monospace">${escapeHtml(tokens.refresh_token)}</textarea>
        <p style="margin-top:1.25rem"><a href="/">Back to app</a></p>
        <script>
          try {
            localStorage.setItem('batcave-revolut-refresh-token', ${tokenJson});
          } catch (e) {}
        </script>
      </body></html>`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed'
    console.error('revolut oauth callback failed', err)
    return html(
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
