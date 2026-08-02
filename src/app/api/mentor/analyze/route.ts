import { NextRequest, NextResponse } from 'next/server'
import {
  getAnthropicClient,
  MENTOR_MODEL,
  mentorNotConfiguredResponse,
} from '@/lib/mentor/anthropic'
import { ANALYZE_JSON_INSTRUCTION, MENTOR_SYSTEM_PROMPT } from '@/lib/mentor/context'

export const runtime = 'nodejs'
export const maxDuration = 90

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function parseInsightJson(raw: string): {
  summary: string
  weapons: string[]
  drags: string[]
  blindSpots: string[]
  prescriptions: string[]
  chatReply: string
} | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fenced ? fenced[1].trim() : trimmed
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
    if (!summary) return null
    return {
      summary,
      weapons: asStringArray(parsed.weapons),
      drags: asStringArray(parsed.drags),
      blindSpots: asStringArray(parsed.blindSpots),
      prescriptions: asStringArray(parsed.prescriptions),
      chatReply:
        typeof parsed.chatReply === 'string' && parsed.chatReply.trim()
          ? parsed.chatReply.trim()
          : summary,
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = getAnthropicClient()
    if (!client) return mentorNotConfiguredResponse()

    const body = (await req.json()) as { context?: string }
    const context = typeof body.context === 'string' ? body.context : ''
    if (!context.trim()) {
      return NextResponse.json({ error: 'Context required' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: MENTOR_MODEL,
      max_tokens: 2200,
      system: `${MENTOR_SYSTEM_PROMPT}\n\n${ANALYZE_JSON_INSTRUCTION}`,
      messages: [
        {
          role: 'user',
          content: `Run a full pattern synthesis on this operator. Be specific. Cite times of day, session shapes, breaks, spend, journals, and debrief feelings when the data supports it.\n\n${context}`,
        },
      ],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    const insight = parseInsightJson(text)
    if (!insight) {
      return NextResponse.json(
        { error: 'Could not parse mentor synthesis', raw: text.slice(0, 500) },
        { status: 502 },
      )
    }

    return NextResponse.json({ insight })
  } catch (error) {
    console.error('mentor analyze failed', error)
    const message = error instanceof Error ? error.message : 'Mentor analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
