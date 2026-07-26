import { SignJWT, importPKCS8 } from 'jose'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export type RevolutEnv = 'production' | 'sandbox'

export interface RevolutAccount {
  id: string
  name: string
  balance: number
  currency: string
  state: string
  public: boolean
  created_at: string
  updated_at: string
}

export interface RevolutTxnLeg {
  leg_id: string
  account_id: string
  amount: number
  currency: string
  description?: string
  fee?: number
  bill_amount?: number
  bill_currency?: string
}

export interface RevolutTransaction {
  id: string
  type: string
  state: string
  created_at: string
  updated_at: string
  completed_at?: string
  reference?: string
  merchant?: {
    name?: string
    city?: string
    category_code?: string
    country?: string
  }
  legs: RevolutTxnLeg[]
  card?: {
    id?: string
    card_number?: string
  }
}

interface TokenCache {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

export function revolutEnv(): RevolutEnv {
  const raw = (process.env.REVOLUT_ENV || 'production').toLowerCase()
  return raw === 'sandbox' ? 'sandbox' : 'production'
}

export function revolutApiBase(): string {
  return revolutEnv() === 'sandbox'
    ? 'https://sandbox-b2b.revolut.com/api/1.0'
    : 'https://b2b.revolut.com/api/1.0'
}

export function revolutAuthBase(): string {
  return revolutEnv() === 'sandbox'
    ? 'https://sandbox-b2b.revolut.com'
    : 'https://b2b.revolut.com'
}

export function normalizePrivateKey(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export function getAppSecret(): string {
  return requireEnv('REVOLUT_APP_SECRET')
}

export function assertAppSecret(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.REVOLUT_APP_SECRET?.trim()
  if (!expected) {
    res.status(503).json({ error: 'REVOLUT_APP_SECRET is not configured on the server.' })
    return false
  }
  const header = req.headers['x-revolut-app-secret']
  const provided = Array.isArray(header) ? header[0] : header
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Invalid or missing app secret.' })
    return false
  }
  return true
}

export function jsonError(res: VercelResponse, status: number, error: string) {
  res.status(status).json({ error })
}

async function buildClientAssertion(): Promise<string> {
  const clientId = requireEnv('REVOLUT_CLIENT_ID')
  const privateKeyPem = normalizePrivateKey(requireEnv('REVOLUT_PRIVATE_KEY'))
  const redirectUri = process.env.REVOLUT_REDIRECT_URI?.trim()
  const iss =
    process.env.REVOLUT_JWT_ISS?.trim() ||
    (redirectUri ? new URL(redirectUri).host : '')
  if (!iss) {
    throw new Error('Set REVOLUT_JWT_ISS or REVOLUT_REDIRECT_URI for JWT iss claim.')
  }

  const key = await importPKCS8(privateKeyPem, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(iss)
    .setSubject(clientId)
    .setAudience('https://revolut.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(key)
}

export async function exchangeAuthorizationCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  token_type?: string
  expires_in?: number
}> {
  const assertion = await buildClientAssertion()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  })

  const response = await fetch(`${revolutAuthBase()}/api/1.0/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = (await response.json()) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : `Token exchange failed (${response.status})`,
    )
  }
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') {
    throw new Error('Token exchange response missing access_token / refresh_token.')
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: typeof data.token_type === 'string' ? data.token_type : undefined,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
  }
}

async function refreshAccessToken(): Promise<TokenCache> {
  const refreshToken = requireEnv('REVOLUT_REFRESH_TOKEN')
  const assertion = await buildClientAssertion()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  })

  const response = await fetch(`${revolutAuthBase()}/api/1.0/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = (await response.json()) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : `Failed to refresh Revolut token (${response.status})`,
    )
  }
  if (typeof data.access_token !== 'string') {
    throw new Error('Refresh response missing access_token.')
  }

  const expiresIn =
    typeof data.expires_in === 'number' ? data.expires_in : 40 * 60
  return {
    accessToken: data.access_token,
    // Refresh a minute early
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  }
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken
  }
  tokenCache = await refreshAccessToken()
  return tokenCache.accessToken
}

export async function revolutFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${revolutApiBase()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    let detail = `Revolut API ${response.status}`
    try {
      const err = (await response.json()) as { message?: string }
      if (err.message) detail = err.message
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function listAccounts(): Promise<RevolutAccount[]> {
  return revolutFetch<RevolutAccount[]>('/accounts')
}

export async function listTransactionsForAccount(params: {
  accountId: string
  from: string
  to: string
}): Promise<RevolutTransaction[]> {
  const all: RevolutTransaction[] = []
  let to = params.to

  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({
      account: params.accountId,
      from: params.from,
      to,
      count: '1000',
    })
    const batch = await revolutFetch<RevolutTransaction[]>(`/transactions?${query}`)
    if (!batch.length) break
    all.push(...batch)
    if (batch.length < 1000) break
    const oldest = batch[batch.length - 1]?.created_at
    if (!oldest || oldest <= params.from) break
    to = oldest
  }

  return all
}

/** Inclusive local calendar day in Asia/Makassar (WITA, UTC+8, no DST). */
export function dayBoundsIso(dateKey: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error('date must be YYYY-MM-DD')
  }
  return {
    from: `${dateKey}T00:00:00.000+08:00`,
    to: `${dateKey}T23:59:59.999+08:00`,
  }
}

export function isRevolutConfigured(): {
  configured: boolean
  missing: string[]
  env: RevolutEnv
} {
  const required = [
    'REVOLUT_CLIENT_ID',
    'REVOLUT_PRIVATE_KEY',
    'REVOLUT_REFRESH_TOKEN',
    'REVOLUT_APP_SECRET',
  ]
  const missing = required.filter((key) => !process.env[key]?.trim())
  const hasIss =
    Boolean(process.env.REVOLUT_JWT_ISS?.trim()) ||
    Boolean(process.env.REVOLUT_REDIRECT_URI?.trim())
  if (!hasIss) missing.push('REVOLUT_JWT_ISS or REVOLUT_REDIRECT_URI')
  return {
    configured: missing.length === 0,
    missing,
    env: revolutEnv(),
  }
}
