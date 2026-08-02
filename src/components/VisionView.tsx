'use client'

import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import type { VisionGoal } from '../types'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Modal } from './ui/Modal'

export function VisionView({ store }: { store: Store }) {
  const goals = store.state.visionGoals ?? []
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [pendingDelete, setPendingDelete] = useState<VisionGoal | null>(null)
  const [heroOpen, setHeroOpen] = useState(false)

  const canCapture = Boolean(draftTitle.trim() || draftBody.trim())

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCapture) return
    store.addVisionGoal({ title: draftTitle, body: draftBody })
    setDraftTitle('')
    setDraftBody('')
  }

  const startEdit = (goal: VisionGoal) => {
    setEditingId(goal.id)
    setEditTitle(goal.title)
    setEditBody(goal.body)
  }

  const saveEdit = () => {
    if (!editingId) return
    if (!editTitle.trim() && !editBody.trim()) return
    store.updateVisionGoal(editingId, { title: editTitle, body: editBody })
    setEditingId(null)
    setEditTitle('')
    setEditBody('')
  }

  return (
    <div className="layout-stack vision-view">
      <section className="vision-hero" aria-label="Dream home">
        <button
          type="button"
          className="vision-hero-frame"
          onClick={() => setHeroOpen(true)}
          aria-label="Open dream home board full screen"
        >
          <img
            src="/dream-home.webp"
            alt="Dream home vision board: mansion with wife's SUV, Ferrari, McLaren and Kawasaki Ninja, gym, boxing ring, pilates studio, outdoor area and man cave"
            className="vision-hero-img"
          />
          <span className="vision-hero-expand" aria-hidden>
            Expand
          </span>
        </button>
        <div className="vision-hero-copy">
          <span className="vision-hero-kicker">The Horizon</span>
          <span className="vision-hero-title">Dream Home</span>
          <span className="vision-hero-sub">
            The house I&apos;m building. Every deep work session is a brick.
          </span>
        </div>
      </section>

      <section className="action-board">
        <header className="action-board-head">
          <h2 className="action-board-title">Vision</h2>
          <p className="action-board-copy">
            Big, long-term goals that pull you forward. Not this week — the horizon.
          </p>
        </header>

        <form className="vision-capture" onSubmit={submit}>
          <label className="field">
            <span className="field-label">The goal</span>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="What are you becoming / building / claiming?"
              aria-label="Vision goal title"
            />
          </label>
          <label className="field">
            <span className="field-label">Why it inspires</span>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Make it vivid — the feeling, the stake, the picture."
              rows={4}
              aria-label="Vision goal inspiration"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={!canCapture}>
            Add to vision
          </button>
        </form>
      </section>

      {goals.length === 0 ? (
        <p className="vision-empty">No horizon goals yet. Write the first one that lights you up.</p>
      ) : (
        <ul className="vision-list">
          {goals.map((goal) => (
            <li key={goal.id} className="vision-card">
              {editingId === goal.id ? (
                <div className="vision-edit">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    aria-label="Edit vision title"
                    autoFocus
                  />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                    aria-label="Edit vision body"
                  />
                  <div className="btn-row">
                    <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn-primary" onClick={saveEdit}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="vision-card-title">{goal.title}</h3>
                  {goal.body.trim() ? <p className="vision-card-body">{goal.body}</p> : null}
                  <div className="vision-card-actions">
                    <button type="button" className="ghost-btn" onClick={() => startEdit(goal)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setPendingDelete(goal)}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={heroOpen}
        onClose={() => setHeroOpen(false)}
        title="Dream Home"
        size="xl"
        className="vision-hero-modal"
      >
        <img
          src="/dream-home.webp"
          alt="Dream home vision board, full size"
          className="vision-hero-full"
        />
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove vision goal"
        message={
          pendingDelete
            ? `Remove “${pendingDelete.title}” from your vision?`
            : 'Remove this vision goal?'
        }
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) store.removeVisionGoal(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
