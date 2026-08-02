import { NextRequest, NextResponse } from 'next/server'
import {
  getAnthropicClient,
  MENTOR_MODEL,
  mentorNotConfiguredResponse,
} from '@/lib/mentor/anthropic'
import { ANALYZE_JSON_INSTRUCTION, MENTOR_SYSTEM_PROMPT } from '@/lib/mentor/context'
import { parseJsonRecord } from '@/lib/mentor/parseJson'

export const runtime = 'nodejs'
export const maxDuration = 90

type MentorInsightPayload = {
  summary: string
  weapons: string[]
  drags: string[]
  blindSpots: string[]
  prescriptions: string[]
  chatReply: string
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function normalizeInsight(parsed: Record<string, unknown>, fallbackText = ''): MentorInsightPayload | null {
  const summary =
    (typeof parsed.summary === 'string' && parsed.summary.trim()) ||
    (typeof parsed.read === 'string' && parsed.read.trim()) ||
    (typeof parsed.analysis === 'string' && parsed.analysis.trim()) ||
    fallbackText.trim()
  if (!summary) return null

  return {
    summary,
    weapons: asStringArray(parsed.weapons ?? parsed.strengths),
    drags: asStringArray(parsed.drags ?? parsed.leaks ?? parsed.weaknesses),
    blindSpots: asStringArray(parsed.blindSpots ?? parsed.blind_spots),
    prescriptions: asStringArray(parsed.prescriptions ?? parsed.actions ?? parsed.recommendations),
    chatReply:
      typeof parsed.chatReply === 'string' && parsed.chatReply.trim()
        ? parsed.chatReply.trim()
        : typeof parsed.chat_reply === 'string' && parsed.chat_reply.trim()
          ? parsed.chat_reply.trim()
          : summary,
  }
}

function parseInsightJson(raw: string): MentorInsightPayload | null {
  const parsed = parseJsonRecord(raw)
  if (parsed) return normalizeInsight(parsed)

  // Last resort: model returned prose — still surface a usable synthesis
  const prose = raw.trim()
  if (prose.length >= 40) {
    return {
      summary: prose.slice(0, 1200),
      weapons: [],
      drags: [],
      blindSpots: [],
      prescriptions: [],
      chatReply: prose.slice(0, 800),
    }
  }
  return null
}

const SYNTHESIS_TOOL = {
  name: 'submit_mentor_synthesis',
  description: 'Submit the structured mentor pattern synthesis for this operator.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description: '2-4 sentence read on how they currently operate',
      },
      weapons: {
        type: 'array',
        items: { type: 'string' },
        description: 'What makes them lethal — specific, evidence-backed',
      },
      drags: {
        type: 'array',
        items: { type: 'string' },
        description: 'What bleeds performance — specific, evidence-backed',
      },
      blindSpots: {
        type: 'array',
        items: { type: 'string' },
        description: 'Patterns they are likely missing',
      },
      prescriptions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Concrete systems / rules / constraints to install',
      },
      chatReply: {
        type: 'string',
        description: 'Short mentor message for the chat thread summarizing the synthesis',
      },
    },
    required: ['summary', 'weapons', 'drags', 'blindSpots', 'prescriptions', 'chatReply'],
  },
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
      max_tokens: 4096,
      system: `${MENTOR_SYSTEM_PROMPT}\n\n${ANALYZE_JSON_INSTRUCTION}`,
      tools: [SYNTHESIS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_mentor_synthesis' },
      messages: [
        {
          role: 'user',
          content: `Run a full pattern synthesis on this operator. Be specific. Cite times of day, session shapes, breaks, spend, journals, and debrief feelings when the data supports it.\n\n${context}`,
        },
      ],
    })

    const toolBlock = response.content.find(
      (b): b is Extract<typeof b, { type: 'tool_use' }> =>
        b.type === 'tool_use' && b.name === 'submit_mentor_synthesis',
    )

    let insight: MentorInsightPayload | null = null
    if (toolBlock && toolBlock.input && typeof toolBlock.input === 'object') {
      insight = normalizeInsight(toolBlock.input as Record<string, unknown>)
    }

    if (!insight) {
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      insight = parseInsightJson(text)
    }

    if (!insight) {
      const raw = response.content
        .map((b) => (b.type === 'text' ? b.text : b.type === 'tool_use' ? JSON.stringify(b.input) : ''))
        .join('\n')
        .trim()
      return NextResponse.json(
        {
          error: 'Could not parse mentor synthesis',
          raw: raw.slice(0, 500),
          stop_reason: response.stop_reason,
        },
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
