import type { Store } from '../hooks/useStore'
import type { FinanceRealm } from '../types'
import { formatMoney, totalAllocated, totalMonthlyExpenses, totalSpent } from '../utils/finance'
import { CashAllocationPanel } from './finance/CashAllocationPanel'
import { CashTrackerPanel } from './finance/CashTrackerPanel'
import { SetExpensesPanel } from './finance/SetExpensesPanel'
import { WeekSelector } from './WeekSelector'

export function FinancesView({
  store,
  realm,
}: {
  store: Store
  realm: FinanceRealm
}) {
  const ledger = store.financeFor(realm)
  const monthly = totalMonthlyExpenses(ledger)
  const allocated = totalAllocated(ledger)
  const spent = totalSpent(ledger)

  return (
    <div className="layout-stack finance-view">
      <WeekSelector store={store} />

      <div className="finance-overview">
        <div className="finance-stat">
          <span className="finance-stat-label">Monthly set expenses</span>
          <strong className="finance-stat-value">{formatMoney(monthly)}</strong>
        </div>
        <div className="finance-stat">
          <span className="finance-stat-label">Cash allocated</span>
          <strong className="finance-stat-value">{formatMoney(allocated)}</strong>
        </div>
        <div className="finance-stat">
          <span className="finance-stat-label">Cash spent</span>
          <strong className="finance-stat-value">{formatMoney(spent)}</strong>
        </div>
      </div>

      <div className="grid-2 finance-main-grid">
        <CashAllocationPanel store={store} realm={realm} />
        <SetExpensesPanel store={store} realm={realm} />
      </div>

      <CashTrackerPanel
        store={store}
        realm={realm}
        mode={realm === 'personal' ? 'daily' : 'simple'}
      />
    </div>
  )
}
