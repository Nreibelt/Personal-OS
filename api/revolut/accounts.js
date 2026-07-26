import { assertAppSecret, jsonError } from '../_lib/http.js'
import {
  createRevolutClient,
  isRevolutConfigured,
  refreshTokenFromRequest,
  withRotatedToken,
} from '../_lib/revolut.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return jsonError(res, 405, 'Method not allowed')
    }
    if (!assertAppSecret(req, res)) return

    const refreshToken = refreshTokenFromRequest(req)
    const status = isRevolutConfigured(Boolean(refreshToken))
    if (!status.serverReady) {
      return jsonError(
        res,
        503,
        `Revolut is not fully configured. Missing: ${status.missing.join(', ')}`,
      )
    }
    if (!refreshToken) {
      return jsonError(
        res,
        401,
        'Missing Revolut refresh token. Click Reconnect in the app to sign in again.',
      )
    }

    const toParam = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to
    const displayCurrency = (toParam || 'AUD').toUpperCase()

    const client = createRevolutClient(refreshToken)
    const accounts = await client.listAccounts()
    const rateCache = new Map()

    const enriched = []
    for (const a of accounts) {
      const currency = (a.currency || '').toUpperCase()
      const balance = typeof a.balance === 'number' ? a.balance : 0
      let displayBalance = balance
      let rate = 1

      if (currency && currency !== displayCurrency) {
        const cacheKey = `${currency}:${displayCurrency}`
        if (!rateCache.has(cacheKey)) {
          rateCache.set(
            cacheKey,
            await client.getExchangeRate(currency, displayCurrency, 1),
          )
        }
        const fx = rateCache.get(cacheKey)
        rate = fx.rate
        displayBalance = Math.round(balance * rate * 100) / 100
      }

      enriched.push({
        id: a.id,
        name: a.name,
        balance,
        currency,
        state: a.state,
        displayCurrency,
        displayBalance,
        rate,
      })
    }

    return res.status(200).json(
      withRotatedToken(
        {
          displayCurrency,
          accounts: enriched,
          rates: Object.fromEntries(
            [...rateCache.entries()].map(([key, value]) => [key, value.rate]),
          ),
        },
        client,
      ),
    )
  } catch (error) {
    console.error('revolut accounts failed', error)
    const message = error instanceof Error ? error.message : 'Failed to list accounts'
    return jsonError(res, 502, message)
  }
}
