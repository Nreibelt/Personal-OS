import { useEffect, useMemo, useState } from 'react'
import type { Store } from '../../hooks/useStore'
import type { FinanceRealm } from '../../types'
import {
  childCategories,
  formatMoney,
  topLevelCategories,
} from '../../utils/finance'
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

type CategoryPick = {
  topId: string
  childId: string
}

export function RevolutSyncPanel({
  store,
  realm,
  onSynced,
}: {
  store: Store
  realm: FinanceRealm
  /** Fired after a successful day sync (e.g. refresh company balances). */
  onSynced?: () => void
}) {
  const sync = store.state.revolutSync
  const accountIdsKey = realm === 'personal' ? 'personalAccountIds' : 'companyAccountIds'
  const queueKey = realm === 'personal' ? 'personalQueue' : 'companyQueue'
  const savedIds = sync[accountIdsKey]
  const queue = sync[queueKey]
  const ledger = store.financeFor(realm)
  const tops = topLevelCategories(ledger)
  const realmLabel = realm === 'personal' ? 'personal' : 'company'

  const [appSecret, setAppSecret] = useState(() => loadRevolutAppSecret())
  const [secretDraft, setSecretDraft] = useState('')
  const [editingSecret, setEditingSecret] = useState(() => !loadRevolutAppSecret())
  const [editingAccounts, setEditingAccounts] = useState(false)
  const [draftIds, setDraftIds] = useState<string[]>(savedIds)
  const [date, setDate] = useState(() => todayDateKey())
  const [accounts, setAccounts] = useState<RevolutAccountDto[]>([])
  const [statusOk, setStatusOk] = useState<boolean | null>(null)
  const [statusDetail, setStatusDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [picks, setPicks] = useState<Record<string, CategoryPick>>({})

  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  )
  const linkedAccounts = savedIds
    .map((id) => accountById.get(id))
    .filter((a): a is RevolutAccountDto => Boolean(a))
  const setupComplete = Boolean(appSecret) && savedIds.length > 0 && !editingAccounts && !editingSecret

  useEffect(() => {
    if (!appSecret) {
      setStatusOk(null)
      setStatusDetail('')
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
            ? `Connected · ${status.env}`
            : `Missing on server: ${status.missing.join(', ')}`,
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

  // First-time: open account editor once connected and nothing saved yet
  useEffect(() => {
    if (statusOk && savedIds.length === 0) {
      setEditingAccounts(true)
      setDraftIds([])
    }
  }, [statusOk, savedIds.length])

  const saveSecret = () => {
    const next = secretDraft.trim()
    if (!next) {
      setError('Enter your app secret first.')
      return
    }
    saveRevolutAppSecret(next)
    setAppSecret(next)
    setSecretDraft('')
    setEditingSecret(false)
    setError('')
    setMessage('')
  }

  const clearSecret = () => {
    saveRevolutAppSecret('')
    setAppSecret('')
    setSecretDraft('')
    setEditingSecret(true)
    setAccounts([])
    setStatusOk(null)
    setStatusDetail('')
  }

  const startEditAccounts = () => {
    setDraftIds(savedIds)
    setEditingAccounts(true)
    setMessage('')
    setError('')
  }

  const cancelEditAccounts = () => {
    setDraftIds(savedIds)
    setEditingAccounts(false)
  }

  const toggleDraft = (id: string) => {
    setDraftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const saveAccounts = () => {
    if (draftIds.length === 0) {
      setError('Select at least one account.')
      return
    }
    store.setRevolutAccountIds(realm, draftIds)
    setEditingAccounts(false)
    setError('')
    setMessage(
      `Saved ${draftIds.length} account${draftIds.length === 1 ? '' : 's'} for ${realmLabel}.`,
    )
  }

  const runSync = async () => {
    if (!appSecret) {
      setError('Link with your app secret first.')
      return
    }
    if (savedIds.length === 0) {
      setError('Save the accounts to sync first.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await fetchRevolutTransactions(appSecret, date, savedIds)
      store.mergeRevolutReviewItems(realm, result.transactions)
      const pendingOut = result.transactions.filter((t) => t.direction === 'out').length
      const pendingIn = result.transactions.filter((t) => t.direction === 'in').length
      setMessage(
        `Pulled ${result.count} for ${date} · ${pendingOut} out · ${pendingIn} in`,
      )
      onSynced?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  const getPick = (id: string): CategoryPick =>
    picks[id] ?? { topId: tops[0]?.id ?? UNEXPECTED, childId: '' }

  const setTop = (id: string, topId: string) => {
    setPicks((prev) => ({
      ...prev,
      [id]: { topId, childId: '' },
    }))
  }

  const setChild = (id: string, childId: string) => {
    setPicks((prev) => ({
      ...prev,
      [id]: { ...getPick(id), childId },
    }))
  }

  const addItem = (itemId: string) => {
    const pick = getPick(itemId)
    if (pick.topId === UNEXPECTED) {
      const item = queue.find((q) => q.id === itemId)
      store.categorizeRevolutReviewItem(realm, itemId, {
        kind: 'unexpected',
        label: item?.merchant || item?.description || 'Revolut spend',
      })
      return
    }

    const kids = childCategories(ledger, pick.topId)
    if (kids.length > 0) {
      if (!pick.childId) {
        setError('Pick the specific bill / sub-expense.')
        return
      }
      store.categorizeRevolutReviewItem(realm, itemId, {
        kind: 'category',
        categoryId: pick.childId,
      })
      return
    }

    store.categorizeRevolutReviewItem(realm, itemId, {
      kind: 'category',
      categoryId: pick.topId,
    })
  }

  const otherRealmIds =
    realm === 'personal' ? sync.companyAccountIds : sync.personalAccountIds

  return (
    <HudPanel
      label="REVOLUT SYNC"
      action={
        statusOk ? (
          <span className="revolut-pill ok">{statusDetail}</span>
        ) : statusOk === false ? (
          <span className="revolut-pill bad">{statusDetail || 'Not connected'}</span>
        ) : null
      }
    >
      {/* Step 1: secret (hidden once saved) */}
      {editingSecret || !appSecret ? (
        <div className="revolut-card">
          <div className="revolut-card-head">
            <h3>Connect</h3>
            <p>Paste the same secret as <code>REVOLUT_APP_SECRET</code> on Vercel.</p>
          </div>
          <div className="revolut-inline">
            <input
              type="password"
              value={secretDraft}
              onChange={(e) => setSecretDraft(e.target.value)}
              placeholder="App secret"
              aria-label="Revolut app secret"
              autoComplete="off"
            />
            <button type="button" className="btn-primary compact" onClick={saveSecret}>
              Save
            </button>
            {appSecret && (
              <button
                type="button"
                className="btn-secondary compact"
                onClick={() => {
                  setEditingSecret(false)
                  setSecretDraft('')
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Step 2: account linking */}
      {appSecret && statusOk && editingAccounts && (
        <div className="revolut-card">
          <div className="revolut-card-head">
            <h3>Accounts for {realmLabel}</h3>
            <p>Tick the Revolut accounts to sync into this tab, then save.</p>
          </div>
          <ul className="revolut-account-grid">
            {accounts.map((account) => {
              const checked = draftIds.includes(account.id)
              const elsewhere = otherRealmIds.includes(account.id)
              return (
                <li key={account.id}>
                  <label className={`revolut-account-tile${checked ? ' on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDraft(account.id)}
                    />
                    <span className="revolut-account-copy">
                      <span className="revolut-account-name">{account.name}</span>
                      <span className="revolut-account-meta">
                        {account.currency} · {formatMoney(account.balance)}
                        {elsewhere
                          ? ` · also in ${realm === 'personal' ? 'company' : 'personal'}`
                          : ''}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {accounts.length === 0 && (
            <p className="finance-empty">Loading accounts…</p>
          )}
          <div className="revolut-actions">
            <button type="button" className="btn-primary compact" onClick={saveAccounts}>
              Save accounts
            </button>
            {savedIds.length > 0 && (
              <button
                type="button"
                className="btn-secondary compact"
                onClick={cancelEditAccounts}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ready state: compact sync */}
      {setupComplete && (
        <div className="revolut-ready">
          <div className="revolut-linked">
            <div className="revolut-linked-head">
              <span className="revolut-linked-label">
                {linkedAccounts.length || savedIds.length} linked account
                {(linkedAccounts.length || savedIds.length) === 1 ? '' : 's'}
              </span>
              <div className="revolut-linked-tools">
                <button type="button" className="revolut-text-btn" onClick={startEditAccounts}>
                  Edit accounts
                </button>
                <button
                  type="button"
                  className="revolut-text-btn"
                  onClick={() => {
                    setEditingSecret(true)
                    setSecretDraft('')
                  }}
                >
                  Change secret
                </button>
                <button type="button" className="revolut-text-btn muted" onClick={clearSecret}>
                  Disconnect
                </button>
              </div>
            </div>
            <div className="revolut-chips">
              {(linkedAccounts.length
                ? linkedAccounts
                : savedIds.map((id) => ({
                    id,
                    name: id.slice(0, 8),
                    currency: '',
                    balance: 0,
                    state: '',
                  }))
              ).map((account) => (
                <span key={account.id} className="revolut-chip">
                  {account.name}
                  {account.currency ? (
                    <em>
                      {account.currency}
                    </em>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <div className="revolut-sync-row">
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
        </div>
      )}

      {!appSecret && (
        <p className="finance-hint revolut-hint">
          One-time setup for {realmLabel}: connect, pick accounts, save. After that just sync.
        </p>
      )}

      {message && <p className="revolut-feedback ok">{message}</p>}
      {error && <p className="revolut-feedback bad">{error}</p>}

      {/* Review queue */}
      {(setupComplete || queue.length > 0) && (
        <div className="revolut-review">
          <div className="revolut-review-head">
            <span>
              Review · {queue.length}
            </span>
          </div>
          {queue.length === 0 ? (
            <p className="finance-empty">No pending transactions. Sync a day to pull them in.</p>
          ) : (
            <ul className="revolut-txn-list">
              {queue.map((item) => {
                const isOut = item.direction === 'out'
                const pick = getPick(item.id)
                const kids =
                  pick.topId !== UNEXPECTED ? childCategories(ledger, pick.topId) : []
                return (
                  <li key={item.id} className="revolut-txn">
                    <div className="revolut-txn-top">
                      <div className="revolut-txn-main">
                        <span className="revolut-txn-name">
                          {item.merchant || item.description}
                        </span>
                        <span className="revolut-txn-meta">
                          <span className={isOut ? 'dir out' : 'dir in'}>
                            {isOut ? 'Out' : 'In'}
                          </span>
                          <span>{item.type.replaceAll('_', ' ')}</span>
                          {item.cardLastFour ? <span>••{item.cardLastFour}</span> : null}
                          <span>{item.accountName}</span>
                        </span>
                      </div>
                      <span className={`revolut-txn-amt${isOut ? '' : ' in'}`}>
                        {isOut ? '−' : '+'}
                        {formatMoney(item.amount)}
                        {item.currency ? ` ${item.currency}` : ''}
                      </span>
                    </div>

                    {isOut ? (
                      <div className="revolut-txn-actions">
                        <select
                          value={pick.topId}
                          onChange={(e) => setTop(item.id, e.target.value)}
                          aria-label={`Category for ${item.merchant}`}
                        >
                          {tops.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                          <option value={UNEXPECTED}>Unexpected</option>
                        </select>

                        {kids.length > 0 && (
                          <select
                            value={pick.childId}
                            onChange={(e) => setChild(item.id, e.target.value)}
                            aria-label={`Specific expense under category`}
                          >
                            <option value="">Select specific…</option>
                            {kids.map((kid) => (
                              <option key={kid.id} value={kid.id}>
                                {kid.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          className="btn-primary compact"
                          onClick={() => {
                            setError('')
                            addItem(item.id)
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
                      <div className="revolut-txn-actions">
                        <span className="revolut-income-tag">Incoming — discard when done</span>
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
      )}
    </HudPanel>
  )
}
