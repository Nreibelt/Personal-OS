import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/revolut/http'
import { revolutEnv, requireEnv } from '@/lib/revolut/client'

/** Redirects to Revolut consent (READ scope). */
export async function GET() {
  try {
    const clientId = requireEnv('REVOLUT_CLIENT_ID')
    const redirectUri = requireEnv('REVOLUT_REDIRECT_URI')
    const scope = 'READ'
    const base =
      revolutEnv() === 'sandbox'
        ? 'https://sandbox-business.revolut.com/app-confirm'
        : 'https://business.revolut.com/app-confirm'

    const url = new URL(base)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', scope)

    return NextResponse.redirect(url.toString())
  } catch (error) {
    console.error('revolut oauth start failed', error)
    const message = error instanceof Error ? error.message : 'OAuth start failed'
    return jsonError(503, message)
  }
}
