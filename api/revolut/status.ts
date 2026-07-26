import { assertAppSecret, jsonError } from '../_lib/http'
import { isRevolutConfigured } from '../_lib/revolut'

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return jsonError(res, 405, 'Method not allowed')
    }
    if (!assertAppSecret(req, res)) return

    const status = isRevolutConfigured()
    return res.status(200).json({
      ok: status.configured,
      env: status.env,
      missing: status.missing,
      hasRefreshToken: status.hasRefreshToken,
    })
  } catch (error) {
    console.error('revolut status failed', error)
    const message = error instanceof Error ? error.message : 'Status check failed'
    return jsonError(res, 500, message)
  }
}
