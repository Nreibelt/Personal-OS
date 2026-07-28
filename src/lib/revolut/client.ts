import { createPrivateKey, sign } from 'node:crypto'
import type { NextRequest } from 'next/server'

export function revolutEnv() {
  const raw = (process.env.REVOLUT_ENV || 'production').toLowerCase()
  return raw === 'sandbox' ? 'sandbox' : 'production'
}

export function revolutApiBase() {
  return revolutEnv() === 'sandbox'
    ? 'https://sandbox-b2b.revolut.com/api/1.0'
    : 'https://b2b.revolut.com/api/1.0'
}

export function revolutAuthBase() {
  return revolutEnv() === 'sandbox'
    ? 'https://sandbox-b2b.revolut.com'
    : 'https://b2b.revolut.com'
}

export function normalizePrivateKey(raw: string) {
  let key = raw.trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1)
  }
  return key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim()
}

export function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function base64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

/** RS256 client_assertion JWT using Node crypto. */
export function buildClientAssertion() {
  const clientId = requireEnv('REVOLUT_CLIENT_ID')
  const privateKeyPem = normalizePrivateKey(requireEnv('REVOLUT_PRIVATE_KEY'))
  const redirectUri = process.env.REVOLUT_REDIRECT_URI?.trim()
  const iss =
    process.env.REVOLUT_JWT_ISS?.trim() ||
    (redirectUri ? new URL(redirectUri).host : '')
  if (!iss) {
    throw new Error('Set REVOLUT_JWT_ISS or REVOLUT_REDIRECT_URI for JWT iss claim.')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64urlJson({ alg: 'RS256', typ: 'JWT' })
  const payload = base64urlJson({
    iss,
    sub: clientId,
    aud: 'https://revolut.com',
    iat: now,
    exp: now + 5 * 60,
  })
  const data = `${header}.${payload}`

  try {
    const key = createPrivateKey(privateKeyPem)
    const signature = sign('RSA-SHA256', Buffer.from(data, 'utf8'), key)
    return `${data}.${signature.toString('base64url')}`
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown key error'
    throw new Error(
      `Failed to read REVOLUT_PRIVATE_KEY (${detail}). Paste the full PEM including BEGIN/END lines; use real newlines or \\n.`,
    )
  }
}

async function postToken(body: URLSearchParams) {
  const response = await fetch(`${revolutAuthBase()}/api/1.0/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = await response.json()
  if (!response.ok) {
    const message =
      typeof data.error_description === 'string'
        ? data.error_description
        : typeof data.message === 'string'
          ? data.message
          : typeof data.error === 'string'
            ? data.error
            : `Token request failed (${response.status})`
    throw new Error(message)
  }
  return data
}

export function refreshTokenFromRequest(req: NextRequest) {
  const fromHeader = req.headers.get('x-revolut-refresh-token')?.trim()
  if (fromHeader) return fromHeader
  return process.env.REVOLUT_REFRESH_TOKEN?.trim() || ''
}

export function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/access token|refresh token|invalid|expired|unauthorized|authoris/i.test(message)) {
    return (
      'Revolut login expired or was replaced. Click Reconnect, approve access again — ' +
      'the new token saves in this browser automatically. Also update Vercel REVOLUT_REFRESH_TOKEN if you use it.'
    )
  }
  return message
}

export async function exchangeAuthorizationCode(code: string) {
  const assertion = buildClientAssertion()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  })

  const data = await postToken(body)
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') {
    throw new Error('Token exchange response missing access_token / refresh_token.')
  }
  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string,
    token_type: typeof data.token_type === 'string' ? data.token_type : undefined,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
  }
}

type RevolutAccount = {
  id: string
  name: string
  balance?: number
  currency?: string
  state?: string
}

type RevolutTxn = {
  id: string
  type?: string
  state?: string
  reference?: string
  created_at?: string
  completed_at?: string
  merchant?: { name?: string }
  card?: { card_number?: string }
  legs?: Array<{
    leg_id: string
    account_id: string
    amount?: number
    currency?: string
    description?: string
  }>
}

/**
 * Per-request Revolut client. Handles access-token refresh and refresh-token rotation.
 * When Revolut issues a new refresh token, `rotatedRefreshToken` is set so the browser can store it.
 */
export function createRevolutClient(refreshToken: string) {
  if (!refreshToken) {
    throw new Error(
      'Missing Revolut refresh token. Click Reconnect to sign in again, or set REVOLUT_REFRESH_TOKEN on Vercel.',
    )
  }

  let currentRefresh = refreshToken
  let rotatedRefreshToken: string | null = null
  let accessToken: string | null = null
  let accessExpiresAt = 0

  async function ensureAccessToken() {
    if (accessToken && accessExpiresAt > Date.now()) return accessToken

    const assertion = buildClientAssertion()
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefresh,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
    })

    let data
    try {
      data = await postToken(body)
    } catch (error) {
      throw new Error(friendlyAuthError(error))
    }

    if (typeof data.access_token !== 'string') {
      throw new Error('Refresh response missing access_token.')
    }

    accessToken = data.access_token
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 40 * 60
    accessExpiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000

    if (
      typeof data.refresh_token === 'string' &&
      data.refresh_token &&
      data.refresh_token !== currentRefresh
    ) {
      currentRefresh = data.refresh_token
      rotatedRefreshToken = data.refresh_token
    }

    return accessToken
  }

  async function fetchJson(path: string, init?: RequestInit) {
    const token = await ensureAccessToken()
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
        const err = await response.json()
        if (err.message) detail = err.message
        else if (err.error_description) detail = err.error_description
        else if (err.error) detail = err.error
      } catch {
        // ignore
      }
      throw new Error(friendlyAuthError(new Error(detail)))
    }

    if (response.status === 204) return undefined
    return response.json()
  }

  return {
    fetchJson,
    listAccounts: () => fetchJson('/accounts') as Promise<RevolutAccount[]>,
    getExchangeRate: async (from: string, to: string, amount = 1) => {
      if (from === to) return { rate: 1, from, to, toAmount: amount }
      const query = new URLSearchParams({
        from,
        to,
        amount: String(amount),
      })
      const data = await fetchJson(`/rate?${query}`)
      const rate = typeof data.rate === 'number' ? data.rate : null
      const toAmount =
        typeof data.to?.amount === 'number'
          ? data.to.amount
          : rate !== null
            ? Math.round(amount * rate * 100) / 100
            : null
      if (rate === null || toAmount === null) {
        throw new Error(`No exchange rate for ${from} → ${to}`)
      }
      return { rate, from, to, toAmount }
    },
    listTransactionsForAccount: async (params: {
      accountId: string
      from: string
      to: string
    }) => {
      const all: RevolutTxn[] = []
      let to = params.to
      for (let page = 0; page < 20; page++) {
        const query = new URLSearchParams({
          account: params.accountId,
          from: params.from,
          to,
          count: '1000',
        })
        const batch = (await fetchJson(`/transactions?${query}`)) as RevolutTxn[]
        if (!batch.length) break
        all.push(...batch)
        if (batch.length < 1000) break
        const oldest = batch[batch.length - 1]?.created_at
        if (!oldest || oldest <= params.from) break
        to = oldest
      }
      return all
    },
    getRotatedRefreshToken: () => rotatedRefreshToken,
    getRefreshToken: () => currentRefresh,
  }
}

export type RevolutClient = ReturnType<typeof createRevolutClient>

export function withRotatedToken<T extends Record<string, unknown>>(
  payload: T,
  client: RevolutClient,
) {
  const rotated = client.getRotatedRefreshToken()
  if (rotated) return { ...payload, refreshToken: rotated }
  return payload
}

/** Inclusive local calendar day in Asia/Makassar (WITA, UTC+8, no DST). */
export function dayBoundsIso(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error('date must be YYYY-MM-DD')
  }
  return {
    from: `${dateKey}T00:00:00.000+08:00`,
    to: `${dateKey}T23:59:59.999+08:00`,
  }
}

export function isRevolutConfigured(hasClientRefreshToken = false) {
  const required = ['REVOLUT_CLIENT_ID', 'REVOLUT_PRIVATE_KEY', 'REVOLUT_APP_SECRET']
  const missing = required.filter((key) => !process.env[key]?.trim())
  const hasIss =
    Boolean(process.env.REVOLUT_JWT_ISS?.trim()) ||
    Boolean(process.env.REVOLUT_REDIRECT_URI?.trim())
  if (!hasIss) missing.push('REVOLUT_JWT_ISS or REVOLUT_REDIRECT_URI')
  const hasEnvRefresh = Boolean(process.env.REVOLUT_REFRESH_TOKEN?.trim())
  const hasRefreshToken = hasEnvRefresh || hasClientRefreshToken
  return {
    serverReady: missing.length === 0,
    configured: missing.length === 0 && hasRefreshToken,
    missing: hasRefreshToken ? missing : [...missing, 'refresh token (reconnect in app or REVOLUT_REFRESH_TOKEN)'],
    env: revolutEnv(),
    hasRefreshToken,
  }
}
