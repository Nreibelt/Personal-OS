'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Render overlays on document.body so ancestors with transform don't trap position:fixed. */
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
