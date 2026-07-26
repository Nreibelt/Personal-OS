import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  assertAppSecret,
  dayBoundsIso,
  isRevolutConfigured,
  jsonError,
  listAccounts,
  listTransactionsForAccount,
  type RevolutTransaction,
} from '../_lib/revolut'

function firstQuery(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function normalizeAccountIds(raw: string | string[] | undefined): string[] {
  if (!raw) return []
  const joined = Array.isArray(raw) ? raw.join(',') : raw
  return [...new Set(joined.split(',').map((s) => s.trim()).filter(Boolean))]
}

export interface NormalizedTxn {
  id: string
  revolutTransactionId: string
  legId: string
  accountId: string
  accountName: string
  date: string
  createdAt: string
  amount: number
  currency: string
  direction: 'in' | 'out'
  type: string
  state: string
  merchant: string
  description: string
  reference?: string
  cardLastFour?: string
}

function normalizeTransaction(
  txn: RevolutTransaction,
  accountNames: Map<string, string>,
  dateKey: string,
  accountFilter: Set<string>,
): NormalizedTxn[] {
  if (txn.state && txn.state !== 'completed' && txn.state !== 'pending') {
    // Still include pending card auth / transfers — user can discard
  }

  const merchant = txn.merchant?.name?.trim() || ''
  const items: NormalizedTxn[] = []

  for (const leg of txn.legs || []) {
    if (!accountFilter.has(leg.account_id)) continue
    if (typeof leg.amount !== 'number' || leg.amount === 0) continue

    const direction: 'in' | 'out' = leg.amount < 0 ? 'out' : 'in'
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const date = firstQuery(req.query.date)
  const accountIds = normalizeAccountIds(req.query.accounts)

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError(res, 400, 'Query param "date" (YYYY-MM-DD) is required.')
  }
  if (accountIds.length === 0) {
    return jsonError(res, 400, 'Query param "accounts" (comma-separated IDs) is required.')
  }

  try {
    const { from, to } = dayBoundsIso(date)
    const accounts = await listAccounts()
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]))
    const accountFilter = new Set(accountIds)

    const unknown = accountIds.filter((id) => !accountNames.has(id))
    if (unknown.length) {
      return jsonError(res, 400, `Unknown account id(s): ${unknown.join(', ')}`)
    }

    const seen = new Set<string>()
    const transactions: NormalizedTxn[] = []

    for (const accountId of accountIds) {
      const raw = await listTransactionsForAccount({ accountId, from, to })
      for (const txn of raw) {
        for (const item of normalizeTransaction(txn, accountNames, date, accountFilter)) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          transactions.push(item)
        }
      }
    }

    transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return res.status(200).json({
      date,
      from,
      to,
      count: transactions.length,
      transactions,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transactions'
    return jsonError(res, 502, message)
  }
}
