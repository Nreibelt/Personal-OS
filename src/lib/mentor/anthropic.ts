import Anthropic from '@anthropic-ai/sdk'

export const MENTOR_MODEL = 'claude-sonnet-4-20250514'

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) return null
  return new Anthropic({ apiKey: key })
}

export function mentorNotConfiguredResponse() {
  return Response.json(
    {
      error:
        'ANTHROPIC_API_KEY is not set. Add an Anthropic API key (console.anthropic.com) — Claude Pro alone does not unlock the API.',
      code: 'missing_api_key',
    },
    { status: 503 },
  )
}
