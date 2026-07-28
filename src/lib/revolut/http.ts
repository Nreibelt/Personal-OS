import { NextRequest, NextResponse } from 'next/server'

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

/** Returns an error response if the app secret is missing/invalid; otherwise null. */
export function assertAppSecret(req: NextRequest): NextResponse | null {
  const expected = process.env.REVOLUT_APP_SECRET?.trim()
  if (!expected) {
    return NextResponse.json(
      { error: 'REVOLUT_APP_SECRET is not configured on the server.' },
      { status: 503 },
    )
  }
  const provided = req.headers.get('x-revolut-app-secret')
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Invalid or missing app secret.' }, { status: 401 })
  }
  return null
}
