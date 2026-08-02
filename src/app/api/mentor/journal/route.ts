import { NextRequest, NextResponse } from 'next/server'
import {
  getAnthropicClient,
  MENTOR_MODEL,
  mentorNotConfiguredResponse,
} from '@/lib/mentor/anthropic'

export const runtime = 'nodejs'
export const maxDuration = 90

const MAX_IMAGE_BYTES = 4_500_000

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

    // Rough size check on base64 payload
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
      max_tokens: 2500,
      system:
        'You extract handwritten or printed journal pages for a high-performance coaching system. Transcribe faithfully. Preserve line breaks for lists. If a date is visible on the page and differs from the provided date, note it. Do not invent content you cannot read — mark illegible spots as [illegible]. Return plain text only.',
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
                `Extract all readable text from this journal page (${sourceName}).`,
                dateHint
                  ? `Operator tagged this page as date ${dateHint}. If the page shows a different date, mention it on the first line as "Page date: …".`
                  : 'If a date is visible on the page, put it on the first line as "Page date: YYYY-MM-DD" or the written form.',
                'Then transcribe the full entry.',
              ].join('\n'),
            },
          ],
        },
      ],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    if (!text) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 502 })
    }

    return NextResponse.json({ text })
  } catch (error) {
    console.error('mentor journal failed', error)
    const message = error instanceof Error ? error.message : 'Journal extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
