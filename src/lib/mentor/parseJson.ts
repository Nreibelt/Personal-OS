/** Extract a JSON object from model text that may include fences or prose. */
export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : trimmed).trim()

  const start = candidate.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return candidate.slice(start, i + 1)
    }
  }

  // Truncated JSON — return null so caller can fall back
  return null
}

export function parseJsonRecord(raw: string): Record<string, unknown> | null {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) return null
  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}
