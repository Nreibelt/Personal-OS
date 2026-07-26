import { assertAppSecret, jsonError } from '../_lib/http.js'
import {
  createRevolutClient,
  isRevolutConfigured,
  refreshTokenFromRequest,
} from '../_lib/revolut.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return jsonError(res, 405, 'Method not allowed')
    }
    if (!assertAppSecret(req, res)) return

    const refreshToken = refreshTokenFromRequest(req)
    const status = isRevolutConfigured(Boolean(refreshToken))

    let authOk = false
    let authError = ''
    let refreshTokenRotated = null

    if (status.serverReady && refreshToken) {
      try {
        const client = createRevolutClient(refreshToken)
        // Cheap authenticated call — proves refresh token works
        await client.listAccounts()
        authOk = true
        refreshTokenRotated = client.getRotatedRefreshToken()
      } catch (error) {
        authError = error instanceof Error ? error.message : 'Auth failed'
      }
    }

    const payload = {
      ok: status.serverReady && authOk,
      serverReady: status.serverReady,
      env: status.env,
      missing: status.missing,
      hasRefreshToken: Boolean(refreshToken),
      authOk,
      authError: authError || undefined,
    }
    if (refreshTokenRotated) payload.refreshToken = refreshTokenRotated

    return res.status(200).json(payload)
  } catch (error) {
    console.error('revolut status failed', error)
    const message = error instanceof Error ? error.message : 'Status check failed'
    return jsonError(res, 500, message)
  }
}
