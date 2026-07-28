'use client'

type Props = {
  onEnterPersonal: () => void
  onEnterBusiness: () => void
}

export function LayerGate({ onEnterPersonal, onEnterBusiness }: Props) {
  return (
    <div className="layer-gate">
      <div className="layer-gate-inner">
        <p className="layer-gate-eyebrow">Personal OS</p>
        <h1 className="layer-gate-title">Where are we operating?</h1>
        <p className="layer-gate-copy">
          Choose a layer. Command Center is personal deep work. Batcave is the company OS.
        </p>
        <div className="layer-gate-actions">
          <button type="button" className="layer-gate-card" onClick={onEnterBusiness}>
            <span className="layer-gate-card-kicker">Business</span>
            <span className="layer-gate-card-name">Enter Batcave</span>
            <span className="layer-gate-card-desc">Company to-dos, finance, and upcoming ops modules</span>
          </button>
          <button type="button" className="layer-gate-card accent" onClick={onEnterPersonal}>
            <span className="layer-gate-card-kicker">Personal</span>
            <span className="layer-gate-card-name">Enter Command Center</span>
            <span className="layer-gate-card-desc">Dashboard, deep work, and personal finances</span>
          </button>
        </div>
      </div>
    </div>
  )
}
