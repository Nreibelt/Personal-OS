import { createPrivateKey, sign } from 'node:crypto'

let tokenCache = null

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

export function normalizePrivateKey(raw) {
  let key = raw.trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1)
  }
  return key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim()
}

export function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function base64urlJson(value) {
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

async function postToken(body) {
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

export async function exchangeAuthorizationCode(code) {
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
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: typeof data.token_type === 'string' ? data.token_type : undefined,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
  }
}

async function refreshAccessToken() {
  const refreshToken = requireEnv('REVOLUT_REFRESH_TOKEN')
  const assertion = buildClientAssertion()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  })

  const data = await postToken(body)
  if (typeof data.access_token !== 'string') {
    throw new Error('Refresh response missing access_token.')
  }

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 40 * 60
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  }
}

export async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken
  }
  tokenCache = await refreshAccessToken()
  return tokenCache.accessToken
}

export async function revolutFetch(path, init) {
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
      const err = await response.json()
      if (err.message) detail = err.message
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  if (response.status === 204) return undefined
  return response.json()
}

export async function listAccounts() {
  return revolutFetch('/accounts')
}

export async function listTransactionsForAccount(params) {
  const all = []
  let to = params.to

  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({
      account: params.accountId,
      from: params.from,
      to,
      count: '1000',
    })
    const batch = await revolutFetch(`/transactions?${query}`)
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
export function dayBoundsIso(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error('date must be YYYY-MM-DD')
  }
  return {
    from: `${dateKey}T00:00:00.000+08:00`,
    to: `${dateKey}T23:59:59.999+08:00`,
  }
}

export function isRevolutConfigured() {
  const required = ['REVOLUT_CLIENT_ID', 'REVOLUT_PRIVATE_KEY', 'REVOLUT_APP_SECRET']
  const missing = required.filter((key) => !process.env[key]?.trim())
  const hasIss =
    Boolean(process.env.REVOLUT_JWT_ISS?.trim()) ||
    Boolean(process.env.REVOLUT_REDIRECT_URI?.trim())
  if (!hasIss) missing.push('REVOLUT_JWT_ISS or REVOLUT_REDIRECT_URI')
  const hasRefreshToken = Boolean(process.env.REVOLUT_REFRESH_TOKEN?.trim())
  return {
    configured: missing.length === 0 && hasRefreshToken,
    missing: hasRefreshToken ? missing : [...missing, 'REVOLUT_REFRESH_TOKEN'],
    env: revolutEnv(),
    hasRefreshToken,
  }
}
