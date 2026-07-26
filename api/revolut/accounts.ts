import { assertAppSecret, jsonError } from '../_lib/http'
import { isRevolutConfigured, listAccounts } from '../_lib/revolut'

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return jsonError(res, 405, 'Method not allowed')
    }
    if (!assertAppSecret(req, res)) return

    const status = isRevolutConfigured()
    if (!status.configured) {
      return jsonError(
        res,
        503,
        `Revolut is not fully configured. Missing: ${status.missing.join(', ')}`,
      )
    }

    const accounts = await listAccounts()
    return res.status(200).json({
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        balance: a.balance,
        currency: a.currency,
        state: a.state,
      })),
    })
  } catch (error) {
    console.error('revolut accounts failed', error)
    const message = error instanceof Error ? error.message : 'Failed to list accounts'
    return jsonError(res, 502, message)
  }
}
