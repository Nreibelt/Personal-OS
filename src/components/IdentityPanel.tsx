import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { HudPanel } from './HudPanel'

export function IdentityPanel({ store }: { store: Store }) {
  const { state, setIdentity } = store
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    identityTitle: state.identityTitle,
    identityQuestion: state.identityQuestion,
    identityBody: state.identityBody,
  })

  const startEdit = () => {
    setDraft({
      identityTitle: state.identityTitle,
      identityQuestion: state.identityQuestion,
      identityBody: state.identityBody,
    })
    setEditing(true)
  }

  const save = () => {
    setIdentity(draft)
    setEditing(false)
  }

  return (
    <HudPanel
      label="90-DAY IDENTITY"
      action={
        !editing ? (
          <button className="edit-btn" type="button" onClick={startEdit}>
            Edit
          </button>
        ) : null
      }
    >
      {editing ? (
        <div className="identity-edit">
          <input
            value={draft.identityTitle}
            onChange={(e) => setDraft((d) => ({ ...d, identityTitle: e.target.value }))}
            aria-label="Identity title"
          />
          <input
            value={draft.identityQuestion}
            onChange={(e) => setDraft((d) => ({ ...d, identityQuestion: e.target.value }))}
            aria-label="Constant question"
          />
          <textarea
            value={draft.identityBody}
            onChange={(e) => setDraft((d) => ({ ...d, identityBody: e.target.value }))}
            aria-label="Identity body"
          />
          <div className="btn-row">
            <button className="btn-primary" type="button" onClick={save}>
              Save
            </button>
            <button className="btn-secondary" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h1 className="identity-title">{state.identityTitle}</h1>
          <p className="identity-question">{state.identityQuestion}</p>
          <p className="identity-body">{state.identityBody}</p>
        </>
      )}
    </HudPanel>
  )
}
