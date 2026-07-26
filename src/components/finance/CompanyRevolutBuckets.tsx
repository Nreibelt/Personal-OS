import { useEffect, useState } from 'react'
import type { Store } from '../../hooks/useStore'
import {
  fetchRevolutAccounts,
  formatAud,
  formatFx,
  loadRevolutAppSecret,
  type RevolutAccountDto,
} from '../../utils/revolutApi'

export function CompanyRevolutBuckets({
  store,
  refreshTick = 0,
}: {
  store: Store
  /** Bump to refetch live balances (e.g. after Sync day). */
  refreshTick?: number
}) {
  const savedIds = store.state.revolutSync.companyAccountIds
  const savedKey = savedIds.join(',')
  const [rows, setRows] = useState<RevolutAccountDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [manualTick, setManualTick] = useState(0)

  useEffect(() => {
    const secret = loadRevolutAppSecret()
    if (!secret || savedIds.length === 0) {
      setRows([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    void (async () => {
      try {
        const { accounts } = await fetchRevolutAccounts(secret, 'AUD')
        if (cancelled) return
        const selected = savedIds
          .map((id) => accounts.find((a) => a.id === id))
          .filter((a): a is RevolutAccountDto => Boolean(a))
        setRows(selected)
        setUpdatedAt(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        )
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load balances')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [savedKey, refreshTick, manualTick, savedIds])

  if (savedIds.length === 0) return null

  return (
    <section className="company-buckets">
      <div className="company-buckets-head">
        <span className="company-buckets-label">Live accounts · AUD</span>
        <div className="company-buckets-tools">
          {updatedAt && !loading && (
            <span className="company-buckets-stamp">Updated {updatedAt}</span>
          )}
          <button
            type="button"
            className="revolut-text-btn"
            onClick={() => setManualTick((t) => t + 1)}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <p className="revolut-feedback bad">{error}</p>}

      <div className="company-bucket-grid">
        {rows.map((account) => {
          const currency = (account.currency || '').toUpperCase()
          const aud =
            typeof account.displayBalance === 'number'
              ? account.displayBalance
              : account.balance
          const showOriginal = currency && currency !== 'AUD'
          return (
            <article key={account.id} className="company-bucket">
              <span className="company-bucket-name">{account.name}</span>
              <strong className="company-bucket-aud">{formatAud(aud)}</strong>
              {showOriginal ? (
                <span className="company-bucket-fx">
                  ({formatFx(account.balance, currency)})
                </span>
              ) : (
                <span className="company-bucket-fx muted">AUD</span>
              )}
            </article>
          )
        })}
        {rows.length === 0 && !loading && !error && (
          <p className="finance-empty">Link accounts below, then refresh for live balances.</p>
        )}
      </div>
    </section>
  )
}
