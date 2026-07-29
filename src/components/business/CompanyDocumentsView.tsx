'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Store } from '../../hooks/useStore'
import type { CompanyDocument } from '../../types'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HudPanel } from '../HudPanel'
import { DocRichEditor } from './DocRichEditor'

type PendingNav =
  | { type: 'select'; id: string }
  | { type: 'create' }
  | { type: 'upload'; file: File }
  | { type: 'external'; proceed: () => void }

export function CompanyDocumentsView({
  store,
  onDirtyChange,
}: {
  store: Store
  /** Notify parent when the open doc has unsaved edits (for tab/layer leave guards). */
  onDirtyChange?: (dirty: boolean) => void
}) {
  const docs = store.state.companyDocuments
  const [activeId, setActiveId] = useState<string | null>(docs[0]?.id ?? null)
  const [pendingDelete, setPendingDelete] = useState<CompanyDocument | null>(null)
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const savedTitleRef = useRef('')
  const savedContentRef = useRef('')
  const seedEditorRef = useRef(false)
  const draftRef = useRef({ title: '', content: '', dirty: false, activeId: null as string | null })
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = useMemo(
    () => docs.find((d) => d.id === activeId) ?? docs[0] ?? null,
    [docs, activeId],
  )

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
    if (!active && activeId) setActiveId(null)
  }, [active, activeId])

  const activeIdKey = active?.id ?? null
  const docsRef = useRef(docs)
  docsRef.current = docs

  useEffect(() => {
    if (!activeIdKey) {
      setDraftTitle('')
      setDraftContent('')
      setDirty(false)
      savedTitleRef.current = ''
      savedContentRef.current = ''
      return
    }
    const doc = docsRef.current.find((d) => d.id === activeIdKey)
    if (!doc) return
    setDraftTitle(doc.title)
    setDraftContent(doc.content)
    savedTitleRef.current = doc.title
    savedContentRef.current = doc.content
    seedEditorRef.current = true
    setDirty(false)
    setSavedFlash(false)
  }, [activeIdKey])

  useEffect(() => {
    draftRef.current = {
      title: draftTitle,
      content: draftContent,
      dirty,
      activeId: active?.id ?? null,
    }
    onDirtyChange?.(dirty)
  }, [draftTitle, draftContent, dirty, active?.id, onDirtyChange])

  useEffect(() => {
    return () => {
      onDirtyChange?.(false)
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    }
  }, [onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const markDirtyIfChanged = useCallback((title: string, content: string) => {
    setDirty(title !== savedTitleRef.current || content !== savedContentRef.current)
  }, [])

  const saveActive = useCallback(() => {
    const { activeId: id, title, content, dirty: isDirty } = draftRef.current
    if (!id || !isDirty) return false
    store.updateCompanyDocument(id, { title, content })
    savedTitleRef.current = title
    savedContentRef.current = content
    setDirty(false)
    setSavedFlash(true)
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 1600)
    return true
  }, [store])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return
      if (!draftRef.current.dirty || !draftRef.current.activeId) return
      e.preventDefault()
      saveActive()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveActive])

  const runNav = useCallback(
    (nav: PendingNav) => {
      switch (nav.type) {
        case 'select':
          setActiveId(nav.id)
          break
        case 'create': {
          const id = store.addCompanyDocument({ title: 'Untitled document', content: '' })
          setActiveId(id)
          break
        }
        case 'upload': {
          void (async () => {
            const text = await nav.file.text()
            const title = nav.file.name.replace(/\.[^.]+$/, '') || nav.file.name
            const id = store.addCompanyDocument({
              title,
              content: text,
              sourceName: nav.file.name,
            })
            setActiveId(id)
          })()
          break
        }
        case 'external':
          nav.proceed()
          break
      }
    },
    [store],
  )

  const requestLeave = useCallback(
    (nav: PendingNav) => {
      if (!draftRef.current.dirty) {
        runNav(nav)
        return
      }
      setPendingNav(nav)
    },
    [runNav],
  )

  useEffect(() => {
    const onAsk = (e: Event) => {
      const detail = (e as CustomEvent<{ proceed: () => void }>).detail
      if (!detail?.proceed) return
      requestLeave({ type: 'external', proceed: detail.proceed })
    }
    window.addEventListener('batcave:docs-leave', onAsk as EventListener)
    return () => window.removeEventListener('batcave:docs-leave', onAsk as EventListener)
  }, [requestLeave])

  const discardAndLeave = () => {
    if (!pendingNav) return
    const nav = pendingNav
    setPendingNav(null)
    setDirty(false)
    runNav(nav)
  }

  const saveAndLeave = () => {
    if (!pendingNav) return
    const nav = pendingNav
    saveActive()
    setPendingNav(null)
    runNav(nav)
  }

  return (
    <div className="layout-stack company-docs">
      <div className="company-docs-layout">
        <HudPanel label="Documents" className="company-docs-sidebar">
          <div className="company-docs-toolbar">
            <button
              type="button"
              className="btn-primary compact"
              onClick={() => requestLeave({ type: 'create' })}
            >
              New doc
            </button>
            <button
              type="button"
              className="btn-secondary compact"
              onClick={() => {
                requestLeave({
                  type: 'external',
                  proceed: () => fileRef.current?.click(),
                })
              }}
            >
              Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.markdown,.csv,.json,.html,text/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                e.target.value = ''
                if (!file) return
                requestLeave({ type: 'upload', file })
              }}
            />
          </div>

          {docs.length === 0 && (
            <p className="finance-empty">No documents yet. Create or upload one.</p>
          )}

          <ul className="company-docs-list">
            {docs.map((doc) => {
              const isActive = active?.id === doc.id
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    className={`company-docs-item${isActive ? ' active' : ''}${
                      isActive && dirty ? ' unsaved' : ''
                    }`}
                    onClick={() => {
                      if (doc.id === active?.id) return
                      requestLeave({ type: 'select', id: doc.id })
                    }}
                  >
                    <span className="company-docs-item-title">
                      {isActive ? draftTitle || doc.title : doc.title}
                      {isActive && dirty ? <span className="company-docs-unsaved-dot" /> : null}
                    </span>
                    <span className="company-docs-item-meta">
                      {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </HudPanel>

        <HudPanel
          label={active ? 'Editor' : 'Select a document'}
          className="company-docs-editor"
          action={
            active ? (
              <div className="company-docs-editor-actions">
                <span
                  className={`company-docs-save-status${dirty ? ' dirty' : ''}${
                    savedFlash ? ' saved' : ''
                  }`}
                  aria-live="polite"
                >
                  {dirty ? 'Unsaved changes' : savedFlash ? 'Saved' : 'All changes saved'}
                </span>
                <button
                  type="button"
                  className="btn-primary compact"
                  disabled={!dirty}
                  onClick={() => saveActive()}
                  title="Save (Ctrl/Cmd+S)"
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setPendingDelete(active)}
                >
                  Delete
                </button>
              </div>
            ) : undefined
          }
        >
          {!active && <p className="finance-empty">Pick a document or create a new one.</p>}
          {active && (
            <div className="company-docs-edit">
              <input
                className="company-docs-title-input"
                value={draftTitle}
                onChange={(e) => {
                  const title = e.target.value
                  setDraftTitle(title)
                  markDirtyIfChanged(title, draftContent)
                }}
                aria-label="Document title"
              />
              {active.sourceName && (
                <p className="company-docs-source">Uploaded from {active.sourceName}</p>
              )}
              <DocRichEditor
                key={active.id}
                content={draftContent}
                onChange={(html) => {
                  setDraftContent(html)
                  if (seedEditorRef.current) {
                    seedEditorRef.current = false
                    savedContentRef.current = html
                    markDirtyIfChanged(draftTitle, html)
                    return
                  }
                  markDirtyIfChanged(draftTitle, html)
                }}
                placeholder="Write the offer, breakdown, brief…"
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
            setDirty(false)
            setActiveId((id) => (id === pendingDelete.id ? null : id))
          }
          setPendingDelete(null)
        }}
      />

      <ConfirmDialog
        open={!!pendingNav}
        title="Unsaved changes"
        message="You have unsaved changes in this document. Save before leaving, discard them, or keep editing."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        altLabel="Save"
        danger
        onCancel={() => setPendingNav(null)}
        onAlt={saveAndLeave}
        onConfirm={discardAndLeave}
      />
    </div>
  )
}
