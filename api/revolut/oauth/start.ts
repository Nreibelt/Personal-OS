import { jsonError } from '../../_lib/http'
import { revolutEnv, requireEnv } from '../../_lib/revolut'

/**
 * Redirects to Revolut's app-confirm consent page.
 * Use once during setup to obtain an authorization code → refresh token.
 */
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return jsonError(res, 405, 'Method not allowed')
    }

    const clientId = requireEnv('REVOLUT_CLIENT_ID')
    const redirectUri = requireEnv('REVOLUT_REDIRECT_URI')
    const scope = 'READ'
    const base =
      revolutEnv() === 'sandbox'
        ? 'https://sandbox-business.revolut.com/app-confirm'
        : 'https://business.revolut.com/app-confirm'

    const url = new URL(base)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', scope)

    res.statusCode = 302
    res.setHeader('Location', url.toString())
    res.end()
  } catch (error) {
    console.error('revolut oauth start failed', error)
    const message = error instanceof Error ? error.message : 'OAuth start failed'
    return jsonError(res, 503, message)
  }
}
