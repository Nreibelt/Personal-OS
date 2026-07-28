import type { ReactNode } from 'react'

export function HudPanel({
  children,
  className = '',
  label,
  action,
  style,
}: {
  children: ReactNode
  className?: string
  label?: ReactNode
  action?: ReactNode
  style?: React.CSSProperties
}) {
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
