import { assertAppSecret, jsonError } from '../_lib/http.js'
import {
  createRevolutClient,
  dayBoundsIso,
  isRevolutConfigured,
  refreshTokenFromRequest,
  withRotatedToken,
} from '../_lib/revolut.js'

function firstQuery(value) {
  if (Array.isArray(value)) return value[0]
  return value
}

function normalizeAccountIds(raw) {
  if (!raw) return []
  const joined = Array.isArray(raw) ? raw.join(',') : raw
  return [...new Set(joined.split(',').map((s) => s.trim()).filter(Boolean))]
}

function normalizeTransaction(txn, accountNames, dateKey, accountFilter) {
  const merchant = txn.merchant?.name?.trim() || ''
  const items = []

  for (const leg of txn.legs || []) {
    if (!accountFilter.has(leg.account_id)) continue
    if (typeof leg.amount !== 'number' || leg.amount === 0) continue

    const direction = leg.amount < 0 ? 'out' : 'in'
    const amount = Math.round(Math.abs(leg.amount) * 100) / 100
    const description = leg.description?.trim() || merchant || txn.reference || txn.type

    items.push({
      id: `${txn.id}:${leg.leg_id}`,
      revolutTransactionId: txn.id,
      legId: leg.leg_id,
      accountId: leg.account_id,
      accountName: accountNames.get(leg.account_id) || 'Account',
      date: dateKey,
      createdAt: txn.completed_at || txn.created_at,
      amount,
      currency: leg.currency,
      direction,
      type: txn.type,
      state: txn.state,
      merchant: merchant || description,
      description,
      reference: txn.reference,
      cardLastFour: txn.card?.card_number?.slice(-4),
    })
  }

  return items
}

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

    const date = firstQuery(req.query.date)
    const accountIds = normalizeAccountIds(req.query.accounts)

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError(res, 400, 'Query param "date" (YYYY-MM-DD) is required.')
    }
    if (accountIds.length === 0) {
      return jsonError(res, 400, 'Query param "accounts" (comma-separated IDs) is required.')
    }

    const client = createRevolutClient(refreshToken)
    const { from, to } = dayBoundsIso(date)
    const accounts = await client.listAccounts()
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]))
    const accountFilter = new Set(accountIds)

    const unknown = accountIds.filter((id) => !accountNames.has(id))
    if (unknown.length) {
      return jsonError(res, 400, `Unknown account id(s): ${unknown.join(', ')}`)
    }

    const seen = new Set()
    const transactions = []

    for (const accountId of accountIds) {
      const raw = await client.listTransactionsForAccount({ accountId, from, to })
      for (const txn of raw) {
        for (const item of normalizeTransaction(txn, accountNames, date, accountFilter)) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          transactions.push(item)
        }
      }
    }

    transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return res.status(200).json(
      withRotatedToken(
        {
          date,
          from,
          to,
          count: transactions.length,
          transactions,
        },
        client,
      ),
    )
  } catch (error) {
    console.error('revolut transactions failed', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch transactions'
    return jsonError(res, 502, message)
  }
}
