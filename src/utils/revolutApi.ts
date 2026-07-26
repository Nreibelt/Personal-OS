export interface RevolutAccountDto {
  id: string
  name: string
  balance: number
  currency: string
  state: string
}

export interface RevolutTxnDto {
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

const SECRET_STORAGE_KEY = 'batcave-revolut-app-secret'

export function loadRevolutAppSecret(): string {
  try {
    return localStorage.getItem(SECRET_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function saveRevolutAppSecret(secret: string) {
  try {
    if (secret.trim()) localStorage.setItem(SECRET_STORAGE_KEY, secret.trim())
    else localStorage.removeItem(SECRET_STORAGE_KEY)
  } catch {
    // ignore
  }
}

async function revolutRequest<T>(
  path: string,
  appSecret: string,
): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
      'x-revolut-app-secret': appSecret,
    },
  })

  const data = (await response.json().catch(() => ({}))) as {
    error?: string
  } & T

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`)
  }
  return data
}

export async function fetchRevolutStatus(appSecret: string) {
  return revolutRequest<{ ok: boolean; env: string; missing: string[] }>(
    '/api/revolut/status',
    appSecret,
  )
}

export async function fetchRevolutAccounts(appSecret: string) {
  return revolutRequest<{ accounts: RevolutAccountDto[] }>(
    '/api/revolut/accounts',
    appSecret,
  )
}

export async function fetchRevolutTransactions(
  appSecret: string,
  date: string,
  accountIds: string[],
) {
  const params = new URLSearchParams({
    date,
    accounts: accountIds.join(','),
  })
  return revolutRequest<{
    date: string
    count: number
    transactions: RevolutTxnDto[]
  }>(`/api/revolut/transactions?${params}`, appSecret)
}
