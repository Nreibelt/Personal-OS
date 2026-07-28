import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppState } from '@/types'

export type UserAppStateRow = {
  user_id: string
  state: AppState
  updated_at: string
}

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
}

function supabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ''
  )
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabasePublishableKey())
}

/** Browser Supabase client that sends the Clerk session token on each request. */
export function createClerkSupabaseClient(
  getToken: () => Promise<string | null>,
): SupabaseClient | null {
  const url = supabaseUrl()
  const key = supabasePublishableKey()
  if (!url || !key) return null

  return createClient(url, key, {
    async accessToken() {
      return getToken()
    },
  })
}
