import { NextRequest, NextResponse } from 'next/server'
import {
  getAnthropicClient,
  MENTOR_MODEL,
  mentorNotConfiguredResponse,
} from '@/lib/mentor/anthropic'
import { extractDateFromJournalText, parseFlexibleJournalDate } from '@/utils/journalDate'

export const runtime = 'nodejs'
export const maxDuration = 90

const MAX_IMAGE_BYTES = 4_500_000

function parseModelPayload(raw: string): {
  text: string
  detectedDate: string | null
  detectedDateRaw: string | null
} {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1].trim() : trimmed

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>
    const text =
      typeof parsed.text === 'string'
        ? parsed.text.trim()
        : typeof parsed.transcription === 'string'
          ? parsed.transcription.trim()
          : ''
    const rawDate =
      typeof parsed.detectedDateRaw === 'string'
        ? parsed.detectedDateRaw.trim()
        : typeof parsed.pageDate === 'string'
          ? parsed.pageDate.trim()
          : null
    let detectedDate =
      typeof parsed.detectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.detectedDate)
        ? parsed.detectedDate
        : null
    if (!detectedDate && rawDate) detectedDate = parseFlexibleJournalDate(rawDate)
    if (text) {
      if (!detectedDate) {
        const fromText = extractDateFromJournalText(text)
        return {
          text,
          detectedDate: fromText.date,
          detectedDateRaw: rawDate || fromText.raw,
        }
      }
      return { text, detectedDate, detectedDateRaw: rawDate }
    }
  } catch {
    // fall through to plain-text handling
  }

  const fromText = extractDateFromJournalText(trimmed)
  return {
    text: trimmed,
    detectedDate: fromText.date,
    detectedDateRaw: fromText.raw,
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = getAnthropicClient()
    if (!client) return mentorNotConfiguredResponse()

    const body = (await req.json()) as {
      imageBase64?: string
      mediaType?: string
      date?: string
      sourceName?: string
    }

    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 })
    }

    if (imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
      return NextResponse.json({ error: 'Image too large (max ~4.5MB)' }, { status: 413 })
    }

    const mediaType =
      body.mediaType === 'image/png' ||
      body.mediaType === 'image/gif' ||
      body.mediaType === 'image/webp'
        ? body.mediaType
        : 'image/jpeg'

    const dateHint =
      typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : null
    const sourceName =
      typeof body.sourceName === 'string' && body.sourceName.trim()
        ? body.sourceName.trim().slice(0, 120)
        : 'journal page'

    const response = await client.messages.create({
      model: MENTOR_MODEL,
      max_tokens: 2800,
      system: `You extract handwritten or printed journal pages for a high-performance coaching system.

Transcribe faithfully. Preserve line breaks for lists. Do not invent content you cannot read — mark illegible spots as [illegible].

CRITICAL — dates: These journals almost always have a date written at the top (e.g. "July 19th", "19 July", "Jul 19 2026"). Read that header carefully and convert it to ISO YYYY-MM-DD. If the year is missing, infer from context or leave year null in raw form and still return best ISO guess for the current year context.

Return ONLY valid JSON (no markdown fences):
{
  "detectedDate": "YYYY-MM-DD or null",
  "detectedDateRaw": "exactly what was written, e.g. July 19th",
  "text": "full transcription of the page"
}`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
              },
            },
            {
              type: 'text',
              text: [
                `Extract this journal page (${sourceName}).`,
                'Prioritize the date written at the top of the page.',
                dateHint
                  ? `Operator fallback date if none is readable: ${dateHint}. Prefer the page header over this fallback.`
                  : 'If no date is readable, set detectedDate to null.',
              ].join('\n'),
            },
          ],
        },
      ],
    })

    const raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    if (!raw) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 502 })
    }

    const parsed = parseModelPayload(raw)
    if (!parsed.text) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 502 })
    }

    return NextResponse.json({
      text: parsed.text,
      detectedDate: parsed.detectedDate,
      detectedDateRaw: parsed.detectedDateRaw,
    })
  } catch (error) {
    console.error('mentor journal failed', error)
    const message = error instanceof Error ? error.message : 'Journal extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
