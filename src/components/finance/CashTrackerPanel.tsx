import { useMemo, useState, type FormEvent } from 'react'
import type { Store } from '../../hooks/useStore'
import type { FinanceRealm } from '../../types'
import {
  allocatableBuckets,
  budgetForCategory,
  formatMoney,
  parseAmount,
  spentForCategory,
} from '../../utils/finance'
import { formatLongDate, todayDateKey } from '../../utils/time'
import { HudPanel } from '../HudPanel'

export function CashTrackerPanel({
  store,
  realm,
  mode,
  embedded = false,
}: {
  store: Store
  realm: FinanceRealm
  /** personal = daily budget tracker; company = simple spend log */
  mode: 'daily' | 'simple'
  embedded?: boolean
}) {
  const ledger = store.financeFor(realm)
  const date = todayDateKey()
  const buckets = allocatableBuckets(ledger)

  const catLookup = useMemo(() => {
    const map = new Map(ledger.categories.map((c) => [c.id, c]))
    return map
  }, [ledger.categories])

  const [kind, setKind] = useState<'category' | 'unexpected'>('category')
  const [categoryId, setCategoryId] = useState(buckets[0]?.id ?? '')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  // Keep categoryId valid when buckets change
  const effectiveCategoryId =
    buckets.some((b) => b.id === categoryId) ? categoryId : buckets[0]?.id ?? ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseAmount(amount)
    if (parsed === null || parsed <= 0) return
    if (mode === 'simple' || kind === 'unexpected') {
      store.addSpend(realm, {
        date,
        amount: parsed,
        kind: mode === 'simple' ? 'unexpected' : 'unexpected',
        label: mode === 'simple' ? label.trim() || note.trim() || 'Spend' : label,
        note: note || undefined,
      })
    } else {
      if (!effectiveCategoryId) return
      store.addSpend(realm, {
        date,
        amount: parsed,
        kind: 'category',
        categoryId: effectiveCategoryId,
        note: note || undefined,
      })
    }
    setAmount('')
    setLabel('')
    setNote('')
  }

  const todaySpends = ledger.spends.filter((s) => s.date === date)
  const recent = mode === 'simple' ? ledger.spends.slice(0, 12) : todaySpends

  const budgetRows =
    mode === 'daily'
      ? buckets.map((b) => {
          const parent = b.parentId ? catLookup.get(b.parentId) : null
          const freq = parent?.frequency ?? b.frequency
          const budget = budgetForCategory(ledger, b.id)
          const spent = spentForCategory(ledger, b.id, date)
          const remaining = Math.round((budget - spent) * 100) / 100
          const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
          const over = remaining < 0
          return {
            id: b.id,
            label: parent ? `${parent.name} → ${b.name}` : b.name,
            frequency: freq,
            budget,
            spent,
            remaining,
            pct,
            over,
          }
        })
      : []

  return (
    <HudPanel label={mode === 'daily' ? 'DAILY CASH TRACKER' : 'CASH TRACKER'} embedded={embedded}>
      <p className="finance-hint">
        {mode === 'daily'
          ? 'Log today’s outgoings against a set expense or as unexpected. Budget status follows each expense’s frequency.'
          : 'Log cash spent. Keep it basic — amount, what it was for, done.'}
      </p>

      <form className="finance-tracker-form" onSubmit={submit}>
        {mode === 'daily' && (
          <div className="summary-toggle finance-kind-toggle" role="group" aria-label="Spend type">
            <button
              type="button"
              className={kind === 'category' ? 'active' : ''}
              onClick={() => setKind('category')}
            >
              Set expense
            </button>
            <button
              type="button"
              className={kind === 'unexpected' ? 'active' : ''}
              onClick={() => setKind('unexpected')}
            >
              Unexpected
            </button>
          </div>
        )}

        <div className="finance-form-grid">
          {mode === 'daily' && kind === 'category' ? (
            <select
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="Expense category"
              disabled={buckets.length === 0}
            >
              {buckets.length === 0 && <option value="">Add set expenses first</option>}
              {buckets.map((b) => {
                const parent = b.parentId ? catLookup.get(b.parentId) : null
                return (
                  <option key={b.id} value={b.id}>
                    {parent ? `${parent.name} → ${b.name}` : b.name}
                  </option>
                )
              })}
            </select>
          ) : (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={mode === 'simple' ? 'What was it for?' : 'Unexpected expense'}
              aria-label="Expense label"
            />
          )}
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            inputMode="decimal"
            aria-label="Spend amount"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Spend note"
          />
          <button type="submit" className="btn-primary">
            Log spend
          </button>
        </div>
      </form>

      {mode === 'daily' && budgetRows.length > 0 && (
        <div className="finance-budget-board">
          <div className="panel-label">
            <span>BUDGET STATUS · {formatLongDate(date)}</span>
          </div>
          <ul className="finance-budget-list">
            {budgetRows.map((row) => (
              <li key={row.id} className={`finance-budget-row${row.over ? ' over' : ''}`}>
                <div className="finance-budget-head">
                  <span className="finance-expense-name">{row.label}</span>
                  <span className="finance-expense-meta">{row.frequency}</span>
                  <span className="finance-expense-amount">
                    {formatMoney(row.spent)} / {formatMoney(row.budget)}
                  </span>
                </div>
                <div className="finance-budget-bar" aria-hidden>
                  <div
                    className="finance-budget-fill"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <div className="finance-budget-foot">
                  {row.over
                    ? `Over by ${formatMoney(Math.abs(row.remaining))}`
                    : `${formatMoney(row.remaining)} left this ${
                        row.frequency === 'daily'
                          ? 'day'
                          : row.frequency === 'weekly'
                            ? 'week'
                            : row.frequency === 'yearly'
                              ? 'year'
                              : 'month'
                      }`}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="finance-history">
        <div className="panel-label">
          <span>{mode === 'daily' ? 'TODAY’S SPENDS' : 'RECENT SPENDS'}</span>
        </div>
        {recent.length === 0 ? (
          <p className="finance-empty">No spends logged yet.</p>
        ) : (
          <ul className="finance-list">
            {recent.map((s) => {
              const cat = s.categoryId ? catLookup.get(s.categoryId) : null
              const parent = cat?.parentId ? catLookup.get(cat.parentId) : null
              const title =
                s.kind === 'unexpected'
                  ? s.label || 'Unexpected'
                  : parent && cat
                    ? `${parent.name} → ${cat.name}`
                    : cat?.name || 'Spend'
              return (
                <li key={s.id} className="finance-expense-row">
                  <div className="finance-expense-main">
                    <span className="finance-expense-name">{title}</span>
                    <span className="finance-expense-meta">
                      {mode === 'simple' ? formatLongDate(s.date) : ''}
                      {s.note ? `${mode === 'simple' ? ' · ' : ''}${s.note}` : ''}
                    </span>
                  </div>
                  <span className="finance-expense-amount">{formatMoney(s.amount)}</span>
                  <button
                    type="button"
                    className="x-btn visible"
                    aria-label="Remove spend"
                    onClick={() => store.removeSpend(realm, s.id)}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </HudPanel>
  )
}
