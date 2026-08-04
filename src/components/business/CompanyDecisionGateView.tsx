'use client'

import { useState } from 'react'
import type { Store } from '../../hooks/useStore'
import type { CompanyDecision } from '../../types'
import { todayDateKey } from '../../utils/time'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HudPanel } from '../HudPanel'

type Filter = 'open' | 'decided' | 'all'

function formatDecideBy(key: string) {
  try {
    const [y, m, d] = key.split('-').map(Number)
    if (!y || !m || !d) return key
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return key
  }
}

function deadlineTone(decideBy: string, status: CompanyDecision['status']): 'ok' | 'soon' | 'overdue' {
  if (status === 'decided') return 'ok'
  const today = todayDateKey()
  if (decideBy < today) return 'overdue'
  if (decideBy === today) return 'soon'
  const inThree = new Date()
  inThree.setDate(inThree.getDate() + 3)
  const soonKey = todayDateKey(inThree)
  if (decideBy <= soonKey) return 'soon'
  return 'ok'
}

function emptyOptionDrafts(count = 2) {
  return Array.from({ length: count }, () => '')
}

export function CompanyDecisionGateView({ store }: { store: Store }) {
  const decisions = store.state.companyDecisions
  const [filter, setFilter] = useState<Filter>('open')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftWhy, setDraftWhy] = useState('')
  const [draftDecideBy, setDraftDecideBy] = useState(todayDateKey())
  const [draftOptions, setDraftOptions] = useState<string[]>(() => emptyOptionDrafts())
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editWhy, setEditWhy] = useState('')
  const [editDecideBy, setEditDecideBy] = useState('')
  const [pendingDelete, setPendingDelete] = useState<CompanyDecision | null>(null)

  const openCount = decisions.filter((d) => d.status === 'open').length

  const visible = (
    filter === 'all'
      ? decisions
      : decisions.filter((d) => (filter === 'open' ? d.status === 'open' : d.status === 'decided'))
  )
    .slice()
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1
      if (a.decideBy !== b.decideBy) return a.decideBy.localeCompare(b.decideBy)
      return b.updatedAt.localeCompare(a.updatedAt)
    })

  const canCapture = Boolean(draftTitle.trim())

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCapture) return
    store.addCompanyDecision({
      title: draftTitle,
      why: draftWhy,
      decideBy: draftDecideBy || todayDateKey(),
      options: draftOptions,
    })
    setDraftTitle('')
    setDraftWhy('')
    setDraftDecideBy(todayDateKey())
    setDraftOptions(emptyOptionDrafts())
  }

  const startEdit = (decision: CompanyDecision) => {
    setEditingId(decision.id)
    setEditTitle(decision.title)
    setEditWhy(decision.why)
    setEditDecideBy(decision.decideBy)
  }

  const saveEdit = () => {
    if (!editingId || !editTitle.trim()) return
    store.updateCompanyDecision(editingId, {
      title: editTitle,
      why: editWhy,
      decideBy: editDecideBy || todayDateKey(),
    })
    setEditingId(null)
  }

  const setDraftOptionAt = (index: number, value: string) => {
    setDraftOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)))
  }

  const addDraftOptionSlot = () => {
    setDraftOptions((prev) => [...prev, ''])
  }

  const removeDraftOptionSlot = (index: number) => {
    setDraftOptions((prev) => {
      if (prev.length <= 1) return ['']
      return prev.filter((_, i) => i !== index)
    })
  }

  const addOption = (decisionId: string) => {
    const text = (optionDrafts[decisionId] ?? '').trim()
    if (!text) return
    store.addCompanyDecisionOption(decisionId, text)
    setOptionDrafts((prev) => ({ ...prev, [decisionId]: '' }))
  }

  return (
    <div className="layout-stack company-decisions">
      <HudPanel
        label="Decision Gate"
        action={
          <span className="company-decisions-count" title="Open decisions">
            {openCount} open
          </span>
        }
      >
        <p className="finance-hint">
          Write the decision. Add the options underneath. Pick one when you&apos;re ready.
        </p>

        <form className="company-decisions-capture" onSubmit={submit}>
          <div className="company-decisions-fields">
            <input
              className="company-decisions-title-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="The decision…"
              aria-label="Decision"
              autoComplete="off"
            />

            <div className="company-decisions-options-block">
              <div className="company-decisions-options-label">
                <span>Options</span>
                <em>Add one, two, or as many as you need</em>
              </div>
              <ul className="company-decisions-draft-options">
                {draftOptions.map((opt, index) => (
                  <li key={`draft-opt-${index}`} className="company-decisions-draft-option">
                    <span className="company-decisions-draft-index" aria-hidden>
                      {index + 1}
                    </span>
                    <input
                      value={opt}
                      onChange={(e) => setDraftOptionAt(index, e.target.value)}
                      placeholder={
                        index === 0
                          ? 'Option A…'
                          : index === 1
                            ? 'Option B…'
                            : `Option ${index + 1}…`
                      }
                      aria-label={`Option ${index + 1}`}
                      autoComplete="off"
                    />
                    {draftOptions.length > 1 && (
                      <button
                        type="button"
                        className="ghost-btn company-decision-option-remove"
                        onClick={() => removeDraftOptionSlot(index)}
                        aria-label={`Remove option ${index + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="ghost-btn company-decisions-add-option-slot"
                onClick={addDraftOptionSlot}
              >
                + Add another option
              </button>
            </div>

            <div className="company-decisions-meta-row">
              <label className="company-decisions-date-field">
                <span>Decide by</span>
                <input
                  type="date"
                  value={draftDecideBy}
                  onChange={(e) => setDraftDecideBy(e.target.value)}
                  aria-label="Decide by date"
                />
              </label>
              <textarea
                value={draftWhy}
                onChange={(e) => setDraftWhy(e.target.value)}
                placeholder="Why this matters (optional)…"
                rows={2}
                aria-label="Why this decision"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={!canCapture}>
            Add decision
          </button>
        </form>

        <div className="company-decisions-filters" role="tablist" aria-label="Filter decisions">
          {(
            [
              { id: 'open', label: 'Open' },
              { id: 'decided', label: 'Decided' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`company-decisions-filter${filter === f.id ? ' active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <p className="finance-empty">
            {filter === 'open'
              ? 'No open loops. Add a decision, then the options under it.'
              : filter === 'decided'
                ? 'No decided items yet.'
                : 'Gate is clear. Add your first decision.'}
          </p>
        )}

        <ul className="company-decisions-list">
          {visible.map((decision) => {
            const tone = deadlineTone(decision.decideBy, decision.status)
            const chosen = decision.options.find((o) => o.id === decision.chosenOptionId)

            return (
              <li
                key={decision.id}
                className={`company-decision${decision.status === 'decided' ? ' is-decided' : ''} tone-${tone}`}
              >
                {editingId === decision.id ? (
                  <div className="company-decision-edit">
                    <input
                      className="company-decisions-title-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="The decision…"
                      aria-label="Edit decision"
                      autoFocus
                    />
                    <label className="company-decisions-date-field">
                      <span>Decide by</span>
                      <input
                        type="date"
                        value={editDecideBy}
                        onChange={(e) => setEditDecideBy(e.target.value)}
                        aria-label="Edit decide by date"
                      />
                    </label>
                    <textarea
                      value={editWhy}
                      onChange={(e) => setEditWhy(e.target.value)}
                      placeholder="Why this matters (optional)…"
                      rows={2}
                      aria-label="Edit why"
                    />
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn-secondary compact"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary compact"
                        disabled={!editTitle.trim()}
                        onClick={saveEdit}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="company-decision-card">
                    <header className="company-decision-main">
                      <h3 className="company-decision-title">{decision.title}</h3>
                      <div className="company-decision-badges">
                        <span className={`company-decision-deadline tone-${tone}`}>
                          {decision.status === 'decided'
                            ? 'Decided'
                            : tone === 'overdue'
                              ? `Overdue · ${formatDecideBy(decision.decideBy)}`
                              : `Decide by ${formatDecideBy(decision.decideBy)}`}
                        </span>
                      </div>
                      {decision.why ? (
                        <p className="company-decision-why">
                          <span className="company-decision-why-label">Why</span>
                          {decision.why}
                        </p>
                      ) : null}
                      {decision.status === 'decided' && chosen ? (
                        <p className="company-decision-chosen">
                          <span>Chose</span> {chosen.text}
                        </p>
                      ) : null}
                    </header>

                    <div className="company-decision-body">
                      <div className="company-decisions-options-label">
                        <span>Options</span>
                        <em>
                          {decision.status === 'open'
                            ? 'Pick one when ready'
                            : `${decision.options.length} considered`}
                        </em>
                      </div>

                      <ul className="company-decision-options">
                        {decision.options.length === 0 && (
                          <li className="company-decision-options-empty">
                            No options yet — add the choices below.
                          </li>
                        )}
                        {decision.options.map((option, index) => {
                          const isChosen = decision.chosenOptionId === option.id
                          return (
                            <li
                              key={option.id}
                              className={`company-decision-option${isChosen ? ' chosen' : ''}`}
                            >
                              <span className="company-decisions-draft-index" aria-hidden>
                                {index + 1}
                              </span>
                              {decision.status === 'open' ? (
                                <button
                                  type="button"
                                  className="company-decision-option-pick"
                                  onClick={() =>
                                    store.decideCompanyDecision(decision.id, option.id)
                                  }
                                  title="Choose this option"
                                >
                                  <span className="company-decision-option-radio" aria-hidden />
                                  <span>{option.text}</span>
                                </button>
                              ) : (
                                <div className="company-decision-option-static">
                                  <span
                                    className={`company-decision-option-radio${isChosen ? ' on' : ''}`}
                                    aria-hidden
                                  />
                                  <span>{option.text}</span>
                                </div>
                              )}
                              {decision.status === 'open' && (
                                <button
                                  type="button"
                                  className="ghost-btn company-decision-option-remove"
                                  onClick={() =>
                                    store.removeCompanyDecisionOption(decision.id, option.id)
                                  }
                                  aria-label={`Remove option ${option.text}`}
                                >
                                  ×
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>

                      {decision.status === 'open' && (
                        <form
                          className="company-decision-add-option"
                          onSubmit={(e) => {
                            e.preventDefault()
                            addOption(decision.id)
                          }}
                        >
                          <input
                            value={optionDrafts[decision.id] ?? ''}
                            onChange={(e) =>
                              setOptionDrafts((prev) => ({
                                ...prev,
                                [decision.id]: e.target.value,
                              }))
                            }
                            placeholder="Add another option…"
                            aria-label="New option"
                          />
                          <button
                            type="submit"
                            className="btn-secondary compact"
                            disabled={!(optionDrafts[decision.id] ?? '').trim()}
                          >
                            Add
                          </button>
                        </form>
                      )}

                      <div className="company-decision-actions">
                        {decision.status === 'decided' ? (
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => store.reopenCompanyDecision(decision.id)}
                          >
                            Reopen
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => startEdit(decision)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setPendingDelete(decision)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </HudPanel>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove decision"
        message={
          pendingDelete ? `Remove “${pendingDelete.title}” from the gate?` : ''
        }
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) store.removeCompanyDecision(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
