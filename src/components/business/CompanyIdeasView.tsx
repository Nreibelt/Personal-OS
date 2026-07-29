'use client'

import { useState } from 'react'
import type { Store } from '../../hooks/useStore'
import type { CompanyIdea } from '../../types'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HudPanel } from '../HudPanel'

export function CompanyIdeasView({ store }: { store: Store }) {
  const ideas = store.state.companyIdeas
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [pendingDelete, setPendingDelete] = useState<CompanyIdea | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    store.addCompanyIdea(draft)
    setDraft('')
  }

  const startEdit = (idea: CompanyIdea) => {
    setEditingId(idea.id)
    setEditText(idea.text)
  }

  const saveEdit = () => {
    if (!editingId) return
    store.updateCompanyIdea(editingId, editText)
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="layout-stack company-ideas">
      <HudPanel label="Ideas">
        <p className="finance-hint">
          Brain dump. Get it out of your head — sort later.
        </p>

        <form className="company-ideas-capture" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Dump an idea…"
            rows={3}
            aria-label="New idea"
          />
          <button type="submit" className="btn-primary" disabled={!draft.trim()}>
            Capture
          </button>
        </form>

        {ideas.length === 0 && (
          <p className="finance-empty">Empty vault. Capture the next spark.</p>
        )}

        <ul className="company-ideas-list">
          {ideas.map((idea) => (
            <li key={idea.id} className="company-idea">
              {editingId === idea.id ? (
                <div className="company-idea-edit">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <div className="btn-row">
                    <button type="button" className="btn-secondary compact" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary compact"
                      disabled={!editText.trim()}
                      onClick={saveEdit}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="company-idea-text">{idea.text}</p>
                  <div className="company-idea-meta">
                    <span>
                      {new Date(idea.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className="company-idea-actions">
                      <button type="button" className="ghost-btn" onClick={() => startEdit(idea)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setPendingDelete(idea)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </HudPanel>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove idea"
        message={pendingDelete ? 'Remove this idea from the vault?' : ''}
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) store.removeCompanyIdea(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
