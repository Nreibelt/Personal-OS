import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { HudPanel } from './HudPanel'

export function DailyNotes({ store }: { store: Store }) {
  const [text, setText] = useState('')

  return (
    <HudPanel label="DAILY NOTES & REMINDERS">
      <ul className="bullet-list">
        {store.state.reminders.map((r, i) => (
          <li key={`${r}-${i}`}>
            <span>{r}</span>
            <button type="button" className="x-btn" onClick={() => store.removeReminder(i)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault()
          store.addReminder(text)
          setText('')
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="+ Add a reminder and press Enter"
          aria-label="Add reminder"
        />
      </form>
    </HudPanel>
  )
}
