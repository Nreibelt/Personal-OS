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
  label?: string
  action?: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <section className={`hud-panel ${className}`} style={style}>
      {(label || action) && (
        <div className="panel-label">
          <span>{label}</span>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
