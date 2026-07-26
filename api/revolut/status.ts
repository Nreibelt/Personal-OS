import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertAppSecret, isRevolutConfigured, jsonError } from '../_lib/revolut'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed')
  }
  if (!assertAppSecret(req, res)) return

  const status = isRevolutConfigured()
  return res.status(200).json({
    ok: status.configured,
    env: status.env,
    missing: status.missing,
  })
}
