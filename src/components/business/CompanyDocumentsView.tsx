'use client'

import { useMemo, useRef, useState } from 'react'
import type { Store } from '../../hooks/useStore'
import type { CompanyDocument } from '../../types'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HudPanel } from '../HudPanel'

export function CompanyDocumentsView({ store }: { store: Store }) {
  const docs = store.state.companyDocuments
  const [activeId, setActiveId] = useState<string | null>(docs[0]?.id ?? null)
  const [pendingDelete, setPendingDelete] = useState<CompanyDocument | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const active = useMemo(
    () => docs.find((d) => d.id === activeId) ?? docs[0] ?? null,
    [docs, activeId],
  )

  const createDoc = () => {
    const id = store.addCompanyDocument({ title: 'Untitled document', content: '' })
    setActiveId(id)
  }

  const onUpload = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    const title = file.name.replace(/\.[^.]+$/, '') || file.name
    const id = store.addCompanyDocument({ title, content: text, sourceName: file.name })
    setActiveId(id)
  }

  return (
    <div className="layout-stack company-docs">
      <div className="company-docs-layout">
        <HudPanel label="Documents" className="company-docs-sidebar">
          <div className="company-docs-toolbar">
            <button type="button" className="btn-primary compact" onClick={createDoc}>
              New doc
            </button>
            <button
              type="button"
              className="btn-secondary compact"
              onClick={() => fileRef.current?.click()}
            >
              Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.markdown,.csv,.json,.html,text/*"
              hidden
              onChange={(e) => {
                void onUpload(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </div>

          {docs.length === 0 && (
            <p className="finance-empty">No documents yet. Create or upload one.</p>
          )}

          <ul className="company-docs-list">
            {docs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className={`company-docs-item${active?.id === doc.id ? ' active' : ''}`}
                  onClick={() => setActiveId(doc.id)}
                >
                  <span className="company-docs-item-title">{doc.title}</span>
                  <span className="company-docs-item-meta">
                    {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel
          label={active ? 'Editor' : 'Select a document'}
          className="company-docs-editor"
          action={
            active ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setPendingDelete(active)}
              >
                Delete
              </button>
            ) : undefined
          }
        >
          {!active && <p className="finance-empty">Pick a document or create a new one.</p>}
          {active && (
            <div className="company-docs-edit">
              <input
                className="company-docs-title-input"
                value={active.title}
                onChange={(e) => store.updateCompanyDocument(active.id, { title: e.target.value })}
                aria-label="Document title"
              />
              {active.sourceName && (
                <p className="company-docs-source">Uploaded from {active.sourceName}</p>
              )}
              <textarea
                className="company-docs-body"
                value={active.content}
                onChange={(e) =>
                  store.updateCompanyDocument(active.id, { content: e.target.value })
                }
                placeholder="Write the offer, breakdown, brief…"
                aria-label="Document body"
              />
            </div>
          )}
        </HudPanel>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete document"
        message={pendingDelete ? `Delete “${pendingDelete.title}”? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            store.removeCompanyDocument(pendingDelete.id)
            setActiveId((id) => (id === pendingDelete.id ? null : id))
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
