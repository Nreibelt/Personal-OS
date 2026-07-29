/** Escape HTML special characters in plain text. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Apply inline markdown (**bold**, *italic*, `code`) inside an already-escaped string. */
function inlineMarkdown(escaped: string): string {
  let out = escaped.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  // Single *italic* / _italic_ — avoid matching leftover bold markers
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
  return out
}

/**
 * Normalize stored document content into HTML TipTap can load.
 * Existing docs may be plain text or markdown; new edits are saved as HTML.
 */
export function toEditorHtml(content: string): string {
  const raw = content ?? ''
  if (!raw.trim()) return ''

  // Already HTML from the rich editor (or an .html upload)
  if (/^\s*</.test(raw) && /<\/[a-z][\w-]*>/i.test(raw)) {
    return raw
  }

  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const parts: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (heading) {
      const level = heading[1].length
      parts.push(`<h${level}>${inlineMarkdown(escapeHtml(heading[2]))}</h${level}>`)
      i += 1
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^[-*]\s+/, '')
        items.push(`<li><p>${inlineMarkdown(escapeHtml(text))}</p></li>`)
        i += 1
      }
      parts.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^\d+\.\s+/, '')
        items.push(`<li><p>${inlineMarkdown(escapeHtml(text))}</p></li>`)
        i += 1
      }
      parts.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      parts.push(
        `<blockquote><p>${inlineMarkdown(escapeHtml(quoteLines.join(' ')))}</p></blockquote>`,
      )
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      parts.push('<hr>')
      i += 1
      continue
    }

    const para: string[] = [trimmed]
    i += 1
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim())
      i += 1
    }
    parts.push(`<p>${inlineMarkdown(escapeHtml(para.join(' ')))}</p>`)
  }

  return parts.join('') || `<p>${inlineMarkdown(escapeHtml(raw))}</p>`
}

/** TipTap empty doc is usually `<p></p>` — treat that as blank for storage. */
export function normalizeEditorHtml(html: string): string {
  const trimmed = html.trim()
  if (!trimmed || trimmed === '<p></p>' || trimmed === '<p><br></p>' || trimmed === '<p><br/></p>') {
    return ''
  }
  return html
}
