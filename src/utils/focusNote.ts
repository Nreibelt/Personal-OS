/** Count whitespace-separated words in a focus note. */
export function countFocusWords(note: string): number {
  return note
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

/** Deep work sessions require a concrete build intention — five words minimum. */
export const MIN_FOCUS_WORDS = 5

export function isValidFocusNote(note: string, minWords = MIN_FOCUS_WORDS): boolean {
  return countFocusWords(note) >= minWords
}
