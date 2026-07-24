export function DashboardView() {
  return (
    <div className="dashboard">
      <p className="dashboard-lede">Center. Then move.</p>

      <section className="dashboard-section">
        <h2 className="dashboard-heading">Morning</h2>
        <ol className="dashboard-list">
          <li>Coffee At Home</li>
          <li>Breathwork</li>
          <li>Water &amp; Salt</li>
          <li>Straight into deep work</li>
        </ol>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-heading">Evening</h2>
        <ol className="dashboard-list">
          <li>Plan Tomorrow</li>
          <li>Log Finances</li>
          <li>Write</li>
        </ol>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-heading">Week</h2>
        <div className="dashboard-week">
          <div className="dashboard-week-block">
            <span className="dashboard-week-when">Mon–Sun · Midday</span>
            <p>Foot on the fucking gas. Retard mode. Execute.</p>
          </div>
          <div className="dashboard-week-block">
            <span className="dashboard-week-when">Sunday · Afternoon</span>
            <p>Gyroscope. Assess, plan, personal admin, analyse, go deep.</p>
          </div>
          <div className="dashboard-week-block">
            <span className="dashboard-week-when">Sunday · Evening</span>
            <p>Me time. Chill.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
