'use client'

import type { InputHTMLAttributes } from 'react'

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className = '',
  ...rest
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'>) {
  return (
    <label className={`platform-check ${checked ? 'on' : ''} ${className}`.trim()}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span className="platform-check-box" aria-hidden>
        {checked ? (
          <svg viewBox="0 0 12 12" width="10" height="10">
            <path
              d="M2.5 6.2 5 8.7 9.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {label != null && <span className="platform-check-label">{label}</span>}
    </label>
  )
}
