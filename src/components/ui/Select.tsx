'use client'

import type { SelectHTMLAttributes } from 'react'

export type SelectOption = { value: string; label: string }

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  ariaLabel?: string
  className?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  return (
    <div className={`platform-select ${className}`.trim()}>
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="platform-select-caret" aria-hidden>
        ▾
      </span>
    </div>
  )
}
