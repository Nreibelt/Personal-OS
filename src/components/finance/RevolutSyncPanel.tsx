import { useEffect, useMemo, useState } from 'react'
import type { Store } from '../../hooks/useStore'
import type { FinanceRealm } from '../../types'
import { allocatableBuckets, formatMoney } from '../../utils/finance'
import {
  fetchRevolutAccounts,
  fetchRevolutStatus,
  fetchRevolutTransactions,
  loadRevolutAppSecret,
  saveRevolutAppSecret,
  type RevolutAccountDto,
} from '../../utils/revolutApi'
import { todayDateKey } from '../../utils/time'
import { HudPanel } from '../HudPanel'

const UNEXPECTED = '__unexpected__'

export function RevolutSyncPanel({
  store,
  realm,
}: {
  store: Store
  realm: FinanceRealm
}) {
  const sync = store.state.revolutSync
  const accountIdsKey = realm === 'personal' ? 'personalAccountIds' : 'companyAccountIds'
  const queueKey = realm === 'personal' ? 'personalQueue' : 'companyQueue'
  const selectedIds = sync[accountIdsKey]
  const queue = sync[queueKey]
  const ledger = store.financeFor(realm)
  const buckets = allocatableBuckets(ledger)
  const catLookup = useMemo(
    () => new Map(ledger.categories.map((c) => [c.id, c])),
    [ledger.categories],
  )

  const [appSecret, setAppSecret] = useState(() => loadRevolutAppSecret())
  const [secretDraft, setSecretDraft] = useState(() => loadRevolutAppSecret())
  const [date, setDate] = useState(() => todayDateKey())
  const [accounts, setAccounts] = useState<RevolutAccountDto[]>([])
  const [statusOk, setStatusOk] = useState<boolean | null>(null)
  const [statusDetail, setStatusDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [categoryById, setCategoryById] = useState<Record<string, string>>({})

  const otherRealmIds =
    realm === 'personal' ? sync.companyAccountIds : sync.personalAccountIds

  useEffect(() => {
    if (!appSecret) {
      setStatusOk(null)
      setStatusDetail('Paste your REVOLUT_APP_SECRET to connect.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const status = await fetchRevolutStatus(appSecret)
        if (cancelled) return
        setStatusOk(status.ok)
        setStatusDetail(
          status.ok
            ? `Connected (${status.env})`
            : `Server missing: ${status.missing.join(', ')}`,
        )
        if (status.ok) {
          const { accounts: list } = await fetchRevolutAccounts(appSecret)
          if (!cancelled) setAccounts(list)
        }
      } catch (err) {
        if (cancelled) return
        setStatusOk(false)
        setStatusDetail(err instanceof Error ? err.message : 'Connection failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appSecret])

  const saveSecret = () => {
    saveRevolutAppSecret(secretDraft)
    setAppSecret(secretDraft.trim())
    setMessage('App secret saved in this browser.')
    setError('')
  }

  const toggleAccount = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    store.setRevolutAccountIds(realm, next)
  }

  const runSync = async () => {
    if (!appSecret) {
      setError('Save your app secret first.')
      return
    }
    if (selectedIds.length === 0) {
      setError('Select at least one account to sync.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await fetchRevolutTransactions(appSecret, date, selectedIds)
      store.mergeRevolutReviewItems(realm, result.transactions)
      const pendingOut = result.transactions.filter((t) => t.direction === 'out').length
      const pendingIn = result.transactions.filter((t) => t.direction === 'in').length
      setMessage(
        `Pulled ${result.count} txn${result.count === 1 ? '' : 's'} for ${date} (${pendingOut} out · ${pendingIn} in). Review below.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  const defaultCategory = buckets[0]?.id ?? UNEXPECTED

  const categoryValue = (id: string) => categoryById[id] ?? defaultCategory

  return (
    <HudPanel label="REVOLUT SYNC">
      <p className="finance-hint">
        Pick the Revolut Business accounts for{' '}
        {realm === 'personal' ? 'personal' : 'company'} expenses, sync a day, then
        categorize outflows or discard internals.
      </p>

      <div className="revolut-setup">
        <label className="finance-field">
          <span>App secret</span>
          <div className="finance-form-row">
            <input
              type="password"
              value={secretDraft}
              onChange={(e) => setSecretDraft(e.target.value)}
              placeholder="Same value as REVOLUT_APP_SECRET on Vercel"
              aria-label="Revolut app secret"
              autoComplete="off"
            />
            <button type="button" className="btn-secondary compact" onClick={saveSecret}>
              Save
            </button>
          </div>
        </label>
        <p className={`revolut-status${statusOk === false ? ' bad' : statusOk ? ' ok' : ''}`}>
          {statusDetail || '—'}
        </p>
      </div>

      {accounts.length > 0 && (
        <div className="revolut-accounts">
          <div className="panel-label">
            <span>ACCOUNTS FOR THIS REALM</span>
          </div>
          <ul className="revolut-account-list">
            {accounts.map((account) => {
              const checked = selectedIds.includes(account.id)
              const usedElsewhere = otherRealmIds.includes(account.id)
              return (
                <li key={account.id}>
                  <label className="revolut-account-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAccount(account.id)}
                    />
                    <span className="revolut-account-main">
                      <span className="finance-expense-name">{account.name}</span>
                      <span className="finance-expense-meta">
                        {account.currency} · {formatMoney(account.balance)}
                        {usedElsewhere
                          ? ` · also in ${realm === 'personal' ? 'company' : 'personal'}`
                          : ''}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="revolut-sync-bar">
        <label className="finance-field">
          <span>Day</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Sync date"
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void runSync()}
          disabled={busy || !statusOk}
        >
          {busy ? 'Syncing…' : 'Sync day'}
        </button>
      </div>

      {message && <p className="revolut-feedback ok">{message}</p>}
      {error && <p className="revolut-feedback bad">{error}</p>}

      <div className="finance-history revolut-review">
        <div className="panel-label">
          <span>
            REVIEW QUEUE · {queue.length} item{queue.length === 1 ? '' : 's'}
          </span>
        </div>
        {queue.length === 0 ? (
          <p className="finance-empty">Nothing to review. Sync a day to pull transactions.</p>
        ) : (
          <ul className="finance-list">
            {queue.map((item) => {
              const isOut = item.direction === 'out'
              return (
                <li key={item.id} className="revolut-review-row">
                  <div className="finance-expense-main">
                    <span className="finance-expense-name">
                      {item.merchant || item.description}
                    </span>
                    <span className="finance-expense-meta">
                      {item.direction === 'out' ? 'Out' : 'In'} · {item.type}
                      {item.cardLastFour ? ` · ••${item.cardLastFour}` : ''} ·{' '}
                      {item.accountName}
                      {item.description && item.description !== item.merchant
                        ? ` · ${item.description}`
                        : ''}
                    </span>
                  </div>
                  <span
                    className={`finance-expense-amount${isOut ? '' : ' in'}`}
                  >
                    {isOut ? '−' : '+'}
                    {formatMoney(item.amount)}
                    {item.currency !== 'GBP' ? ` ${item.currency}` : ''}
                  </span>

                  {isOut ? (
                    <div className="revolut-review-actions">
                      <select
                        value={categoryValue(item.id)}
                        onChange={(e) =>
                          setCategoryById((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        aria-label={`Category for ${item.merchant}`}
                      >
                        {buckets.map((b) => {
                          const parent = b.parentId ? catLookup.get(b.parentId) : null
                          return (
                            <option key={b.id} value={b.id}>
                              {parent ? `${parent.name} → ${b.name}` : b.name}
                            </option>
                          )
                        })}
                        <option value={UNEXPECTED}>Unexpected</option>
                      </select>
                      <button
                        type="button"
                        className="btn-primary compact"
                        onClick={() => {
                          const value = categoryValue(item.id)
                          if (value === UNEXPECTED) {
                            store.categorizeRevolutReviewItem(realm, item.id, {
                              kind: 'unexpected',
                              label: item.merchant || item.description || 'Revolut spend',
                            })
                          } else {
                            store.categorizeRevolutReviewItem(realm, item.id, {
                              kind: 'category',
                              categoryId: value,
                            })
                          }
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        className="btn-secondary compact"
                        onClick={() => store.discardRevolutReviewItem(realm, item.id)}
                      >
                        Discard
                      </button>
                    </div>
                  ) : (
                    <div className="revolut-review-actions">
                      <span className="revolut-income-tag">Incoming</span>
                      <button
                        type="button"
                        className="btn-secondary compact"
                        onClick={() => store.discardRevolutReviewItem(realm, item.id)}
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </HudPanel>
  )
}
