import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { HudPanel } from './HudPanel'

export function MentalRam({ store }: { store: Store }) {
  const [text, setText] = useState('')

  return (
    <HudPanel label="MENTAL RAM // EMPTY YOUR MIND. KEEP ONLY WHAT YOU'RE EXECUTING.">
      <ul className="check-list">
        {store.state.openLoops.map((loop) => (
          <li key={loop.id} className="check-item">
            <button
              type="button"
              className={`check-box${loop.done ? ' on' : ''}`}
              aria-label={loop.done ? 'Mark incomplete' : 'Mark complete'}
              onClick={() => store.toggleLoop(loop.id)}
            >
              {loop.done ? '✓' : ''}
            </button>
            <span className={`check-text${loop.done ? ' done' : ''}`}>{loop.text}</span>
            <button type="button" className="x-btn" onClick={() => store.removeLoop(loop.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault()
          store.addLoop(text)
          setText('')
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="+ Add Open Loop"
          aria-label="Add open loop"
        />
      </form>
    </HudPanel>
  )
}
