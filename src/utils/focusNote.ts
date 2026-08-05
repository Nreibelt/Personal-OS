/** Count whitespace-separated words in a focus note. */
export function countFocusWords(note: string): number {
  return note
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

/**
 * Slight Edge Focus: name one skill/habit to improve this block.
 * Two words minimum keeps “mental model” valid while blocking empty starts.
 */
export const MIN_FOCUS_WORDS = 2

export function isValidFocusNote(note: string, minWords = MIN_FOCUS_WORDS): boolean {
  return countFocusWords(note) >= minWords
}

/** Session target timer bounds (minutes). */
export const MIN_SESSION_TARGET_MINUTES = 5
export const MAX_SESSION_TARGET_MINUTES = 12 * 60
export const SESSION_TARGET_PRESETS = [25, 50, 90] as const

export function isValidSessionTarget(minutes: number): boolean {
  return (
    Number.isFinite(minutes) &&
    Number.isInteger(minutes) &&
    minutes >= MIN_SESSION_TARGET_MINUTES &&
    minutes <= MAX_SESSION_TARGET_MINUTES
  )
}
