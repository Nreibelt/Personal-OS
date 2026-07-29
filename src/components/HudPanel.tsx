import type { ReactNode } from 'react'

export function HudPanel({
  children,
  className = '',
  label,
  action,
  style,
  embedded = false,
}: {
  children: ReactNode
  className?: string
  label?: ReactNode
  action?: ReactNode
  style?: React.CSSProperties
  /** Skip chrome when rendered inside a platform modal */
  embedded?: boolean
}) {
  if (embedded) {
    return (
      <div className={`hud-panel-embedded ${className}`.trim()} style={style}>
        {children}
      </div>
    )
  }

  return (
    <section className={`hud-panel ${className}`} style={style}>
      {(label || action) && (
        <div className="panel-label">
          {typeof label === 'string' || label == null ? <span>{label}</span> : label}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
