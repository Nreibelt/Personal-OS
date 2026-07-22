import { useState } from 'react'
import type { Store } from '../hooks/useStore'
import { HudPanel } from './HudPanel'

export function NonNegotiables({ store }: { store: Store }) {
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)

  return (
    <HudPanel label="NON-NEGOTIABLES // DAILY PROTOCOLS">
      <div className="habits-row">
        {store.state.habits.map((habit) => (
          <button
            key={habit.id}
            type="button"
            className={`habit-chip${habit.done ? ' on' : ''}`}
            onClick={() => store.toggleHabit(habit.id)}
          >
            <span className={`check-box${habit.done ? ' on' : ''}`}>{habit.done ? '✓' : ''}</span>
            <span className="habit-name">{habit.name}</span>
            {habit.streak > 0 && (
              <span className="streak" title="Streak">
                🔥 {habit.streak}
              </span>
            )}
          </button>
        ))}
        {adding ? (
          <form
            className="inline-add"
            style={{ minWidth: 200 }}
            onSubmit={(e) => {
              e.preventDefault()
              store.addHabit(name)
              setName('')
              setAdding(false)
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Habit name"
              onBlur={() => {
                if (!name.trim()) setAdding(false)
              }}
            />
          </form>
        ) : (
          <button className="ghost-btn" type="button" onClick={() => setAdding(true)}>
            + Add habit
          </button>
        )}
      </div>
    </HudPanel>
  )
}
