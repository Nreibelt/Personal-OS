'use client'

import { useEffect, type ReactNode } from 'react'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'modal-sm',
  md: 'modal-md',
  lg: 'modal-lg',
  xl: 'modal-xl',
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: ModalSize
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal platform-modal ${SIZE_CLASS[size]}`}
        role="dialog"
        aria-modal
        aria-labelledby="platform-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="platform-modal-head">
          <h2 id="platform-modal-title">{title}</h2>
          <button type="button" className="x-btn visible" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="platform-modal-body">{children}</div>
        {footer && <footer className="platform-modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}
