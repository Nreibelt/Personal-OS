import { useState, type FormEvent } from 'react'
import type { Store } from '../../hooks/useStore'
import type { ExpenseFrequency, FinanceRealm } from '../../types'
import {
  categoryEffectiveAmount,
  childCategories,
  FREQUENCIES,
  formatMoney,
  parseAmount,
  topLevelCategories,
  totalMonthlyExpenses,
} from '../../utils/finance'
import { HudPanel } from '../HudPanel'

export function SetExpensesPanel({
  store,
  realm,
  embedded = false,
}: {
  store: Store
  realm: FinanceRealm
  embedded?: boolean
}) {
  const ledger = store.financeFor(realm)
  const tops = topLevelCategories(ledger)
  const monthlyTotal = totalMonthlyExpenses(ledger)

  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<ExpenseFrequency>('monthly')
  const [amount, setAmount] = useState('')
  const [microParentId, setMicroParentId] = useState<string | null>(null)
  const [microName, setMicroName] = useState('')
  const [microAmount, setMicroAmount] = useState('')

  const submitCategory = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseAmount(amount)
    if (!name.trim() || parsed === null) return
    store.addExpenseCategory(realm, { name, frequency, amount: parsed })
    setName('')
    setAmount('')
    setFrequency('monthly')
  }

  const submitMicro = (e: FormEvent) => {
    e.preventDefault()
    if (!microParentId) return
    const parsed = parseAmount(microAmount)
    if (!microName.trim() || parsed === null) return
    const parent = ledger.categories.find((c) => c.id === microParentId)
    store.addExpenseCategory(realm, {
      name: microName,
      frequency: parent?.frequency ?? 'monthly',
      amount: parsed,
      parentId: microParentId,
    })
    setMicroName('')
    setMicroAmount('')
  }

  return (
    <HudPanel label="SET EXPENSES" embedded={embedded}>
      <p className="finance-hint">
        Recurring budgets by category. Bills is preset — add micro expenses under it (YouTube,
        subscriptions, etc.).
      </p>

      <ul className="finance-list">
        {tops.map((cat) => {
          const kids = childCategories(ledger, cat.id)
          const effective = categoryEffectiveAmount(cat, ledger.categories)
          return (
            <li key={cat.id} className="finance-expense">
              <div className="finance-expense-row">
                <div className="finance-expense-main">
                  <span className="finance-expense-name">{cat.name}</span>
                  <span className="finance-expense-meta">
                    {cat.frequency}
                    {kids.length > 0 ? ' · micro roll-up' : ''}
                  </span>
                </div>
                <span className="finance-expense-amount">{formatMoney(effective)}</span>
                {!cat.isPreset && (
                  <button
                    type="button"
                    className="x-btn visible"
                    aria-label={`Remove ${cat.name}`}
                    onClick={() => store.removeExpenseCategory(realm, cat.id)}
                  >
                    ×
                  </button>
                )}
              </div>

              {kids.length > 0 && (
                <ul className="finance-micro-list">
                  {kids.map((kid) => (
                    <li key={kid.id} className="finance-micro-row">
                      <span>{kid.name}</span>
                      <span className="finance-expense-amount">{formatMoney(kid.amount)}</span>
                      <button
                        type="button"
                        className="x-btn visible"
                        aria-label={`Remove ${kid.name}`}
                        onClick={() => store.removeExpenseCategory(realm, kid.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {(cat.isPreset || cat.name.toLowerCase() === 'bills') && (
                <div className="finance-micro-actions">
                  {microParentId === cat.id ? (
                    <form className="finance-form-row" onSubmit={submitMicro}>
                      <input
                        value={microName}
                        onChange={(e) => setMicroName(e.target.value)}
                        placeholder="Micro expense (e.g. YouTube)"
                        aria-label="Micro expense name"
                      />
                      <input
                        value={microAmount}
                        onChange={(e) => setMicroAmount(e.target.value)}
                        placeholder="Amount"
                        inputMode="decimal"
                        aria-label="Micro expense amount"
                      />
                      <button type="submit" className="btn-primary compact">
                        Add
                      </button>
                      <button
                        type="button"
                        className="btn-secondary compact"
                        onClick={() => {
                          setMicroParentId(null)
                          setMicroName('')
                          setMicroAmount('')
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setMicroParentId(cat.id)}
                    >
                      + Add micro expense
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <form className="finance-form-grid" onSubmit={submitCategory}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Expense title"
          aria-label="Expense title"
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ExpenseFrequency)}
          aria-label="Frequency"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          inputMode="decimal"
          aria-label="Expense amount"
        />
        <button type="submit" className="btn-primary">
          Add expense
        </button>
      </form>

      <div className="finance-total-bar">
        <span>Total monthly expenses</span>
        <strong>{formatMoney(monthlyTotal)}</strong>
      </div>
    </HudPanel>
  )
}
