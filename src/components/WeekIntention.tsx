import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { HudPanel } from './HudPanel'

export function WeekIntention({ store }: { store: Store }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(store.state.weekIntention)

  return (
    <HudPanel
      label="WEEK INTENTION"
      action={
        !editing ? (
          <button
            className="edit-btn"
            type="button"
            onClick={() => {
              setDraft(store.state.weekIntention)
              setEditing(true)
            }}
          >
            ✎ EDIT
          </button>
        ) : null
      }
    >
      {editing ? (
        <>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} />
          <div className="btn-row" style={{ marginTop: '0.5rem' }}>
            <button
              className="btn-primary"
              type="button"
              onClick={() => {
                store.setWeekIntention(draft)
                setEditing(false)
              }}
            >
              Save
            </button>
            <button className="btn-secondary" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p className="intention-text">{store.state.weekIntention}</p>
      )}
    </HudPanel>
  )
}
