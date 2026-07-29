'use client'

import { useEffect, useState } from 'react'

type Props = {
  onEnterPersonal: () => void
  onEnterBusiness: () => void
}

type Portal = 'batcave' | 'command' | null

export function LayerGate({ onEnterPersonal, onEnterBusiness }: Props) {
  const [ready, setReady] = useState(false)
  const [exiting, setExiting] = useState<Portal>(null)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const enter = (portal: Exclude<Portal, null>) => {
    if (exiting) return
    setExiting(portal)
    window.setTimeout(() => {
      if (portal === 'batcave') onEnterBusiness()
      else onEnterPersonal()
    }, 420)
  }

  return (
    <div
      className={`layer-gate${ready ? ' is-ready' : ''}${exiting ? ' is-exiting' : ''}${
        exiting === 'batcave' ? ' exit-batcave' : exiting === 'command' ? ' exit-command' : ''
      }`}
    >
      <div className="layer-gate-ambiance" aria-hidden="true">
        <div className="layer-gate-grid" />
        <div className="layer-gate-glow layer-gate-glow-a" />
        <div className="layer-gate-glow layer-gate-glow-b" />
        <div className="layer-gate-vignette" />
      </div>

      <div className="layer-gate-inner">
        <p className="layer-gate-eyebrow">Personal OS</p>
        <h1 className="layer-gate-title">Where are we operating?</h1>
        <p className="layer-gate-copy">
          Choose a layer. Command Center is personal deep work. Batcave is the company OS.
        </p>
        <div className="layer-gate-actions">
          <button
            type="button"
            className={`layer-gate-card portal-batcave${exiting === 'batcave' ? ' is-activating' : ''}`}
            onClick={() => enter('batcave')}
            disabled={!!exiting}
          >
            <span className="layer-gate-card-edge" aria-hidden="true" />
            <span className="layer-gate-card-kicker">Business</span>
            <span className="layer-gate-card-name">Enter Batcave</span>
            <span className="layer-gate-card-desc">
              Company to-dos, finance, and upcoming ops modules
            </span>
            <span className="layer-gate-card-cta">Engage →</span>
          </button>
          <button
            type="button"
            className={`layer-gate-card portal-command${exiting === 'command' ? ' is-activating' : ''}`}
            onClick={() => enter('command')}
            disabled={!!exiting}
          >
            <span className="layer-gate-card-edge" aria-hidden="true" />
            <span className="layer-gate-card-kicker">Personal</span>
            <span className="layer-gate-card-name">Enter Command Center</span>
            <span className="layer-gate-card-desc">
              Dashboard, deep work, and personal finances
            </span>
            <span className="layer-gate-card-cta">Engage →</span>
          </button>
        </div>
      </div>

      <div className="layer-gate-veil" aria-hidden="true" />
    </div>
  )
}
