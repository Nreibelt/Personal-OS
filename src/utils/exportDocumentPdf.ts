/** Open a print window so the user can Save as PDF. */
export function exportDocumentPdf(title: string, bodyHtml: string) {
  const safeTitle = title.trim() || 'Document'
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeAttr(safeTitle)}</title>
  <style>
    @page { margin: 18mm 16mm; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.55;
      color: #111;
      max-width: 720px;
      margin: 0 auto;
      padding: 8px 0 24px;
    }
    h1.doc-title {
      font-size: 22pt;
      line-height: 1.2;
      margin: 0 0 1.1em;
      letter-spacing: -0.02em;
    }
    h1 { font-size: 18pt; margin: 1.1em 0 0.45em; }
    h2 { font-size: 14.5pt; margin: 1em 0 0.4em; }
    h3 { font-size: 12.5pt; margin: 0.9em 0 0.35em; }
    p { margin: 0 0 0.75em; }
    ul, ol { margin: 0 0 0.85em; padding-left: 1.35em; }
    li { margin: 0.2em 0; }
    li > p { margin: 0; }
    blockquote {
      margin: 0.8em 0;
      padding: 0.1em 0 0.1em 0.9em;
      border-left: 3px solid #999;
      color: #333;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
      background: #f3f3f3;
      padding: 0.05em 0.3em;
      border-radius: 3px;
    }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.2em 0; }
    strong { font-weight: 700; }
    em { font-style: italic; }
  </style>
</head>
<body>
  <h1 class="doc-title">${escapeAttr(safeTitle)}</h1>
  ${bodyHtml.trim() || '<p><em>Empty document</em></p>'}
</body>
</html>`

  const w = window.open('', '_blank')
  if (!w) {
    window.alert('Allow pop-ups to export this document as PDF.')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Wait a tick so styles paint before the print dialog
  w.focus()
  setTimeout(() => {
    try {
      w.print()
    } catch {
      // ignore
    }
  }, 250)
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
