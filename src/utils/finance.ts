import type { ExpenseCategory, ExpenseFrequency, FinanceLedger, SpendEntry } from '../types'
import { addDays, startOfWeekMonday, weekDays } from './time'

export const FREQUENCIES: ExpenseFrequency[] = ['daily', 'weekly', 'monthly']

export function formatMoney(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return n < 0 ? `−$${formatted}` : `$${formatted}`
}

export function toMonthlyAmount(amount: number, frequency: ExpenseFrequency): number {
  if (frequency === 'daily') return amount * 30
  if (frequency === 'weekly') return amount * (52 / 12)
  return amount
}

export function categoryEffectiveAmount(cat: ExpenseCategory, all: ExpenseCategory[]): number {
  const children = all.filter((c) => c.parentId === cat.id)
  if (children.length === 0) return cat.amount
  return children.reduce((sum, c) => sum + c.amount, 0)
}

export function topLevelCategories(ledger: FinanceLedger): ExpenseCategory[] {
  return ledger.categories.filter((c) => !c.parentId)
}

export function childCategories(ledger: FinanceLedger, parentId: string): ExpenseCategory[] {
  return ledger.categories.filter((c) => c.parentId === parentId)
}

/** Flattened list of allocatable buckets: leaf categories (children) + parents without children. */
export function allocatableBuckets(ledger: FinanceLedger): ExpenseCategory[] {
  const tops = topLevelCategories(ledger)
  const result: ExpenseCategory[] = []
  for (const top of tops) {
    const kids = childCategories(ledger, top.id)
    if (kids.length > 0) result.push(...kids)
    else result.push(top)
  }
  return result
}

export function totalMonthlyExpenses(ledger: FinanceLedger): number {
  return topLevelCategories(ledger).reduce((sum, cat) => {
    const amount = categoryEffectiveAmount(cat, ledger.categories)
    return sum + toMonthlyAmount(amount, cat.frequency)
  }, 0)
}

export function periodDatesFor(
  frequency: ExpenseFrequency,
  date: string,
): { start: string; end: string; dates: string[] } {
  if (frequency === 'daily') {
    return { start: date, end: date, dates: [date] }
  }
  if (frequency === 'weekly') {
    const dates = weekDays(date)
    return { start: dates[0], end: dates[6], dates }
  }
  const [y, m] = date.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const dates: string[] = []
  let cursor = start
  while (cursor <= end) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return { start, end, dates }
}

export function spendsInPeriod(
  spends: SpendEntry[],
  frequency: ExpenseFrequency,
  date: string,
  categoryId?: string,
): SpendEntry[] {
  const { dates } = periodDatesFor(frequency, date)
  const set = new Set(dates)
  return spends.filter((s) => {
    if (!set.has(s.date)) return false
    if (categoryId) {
      return s.kind === 'category' && s.categoryId === categoryId
    }
    return true
  })
}

export function spentForCategory(
  ledger: FinanceLedger,
  categoryId: string,
  date: string,
): number {
  const cat = ledger.categories.find((c) => c.id === categoryId)
  if (!cat) return 0
  // Resolve frequency from the top-level parent when tracking a child
  let freqCat = cat
  if (cat.parentId) {
    const parent = ledger.categories.find((c) => c.id === cat.parentId)
    if (parent) freqCat = parent
  }
  const children = childCategories(ledger, categoryId)
  const ids =
    children.length > 0
      ? new Set([categoryId, ...children.map((c) => c.id)])
      : new Set([categoryId])

  return spendsInPeriod(ledger.spends, freqCat.frequency, date).reduce((sum, s) => {
    if (s.kind === 'category' && s.categoryId && ids.has(s.categoryId)) return sum + s.amount
    return sum
  }, 0)
}

export function budgetForCategory(ledger: FinanceLedger, categoryId: string): number {
  const cat = ledger.categories.find((c) => c.id === categoryId)
  if (!cat) return 0
  if (cat.parentId) return cat.amount
  return categoryEffectiveAmount(cat, ledger.categories)
}

export function allocatedToCategory(ledger: FinanceLedger, categoryId: string): number {
  return ledger.allocations.reduce((sum, a) => {
    return (
      sum +
      a.lines.reduce((lineSum, line) => {
        if (line.kind === 'category' && line.categoryId === categoryId) return lineSum + line.amount
        return lineSum
      }, 0)
    )
  }, 0)
}

export function totalAllocated(ledger: FinanceLedger): number {
  return ledger.allocations.reduce((sum, a) => sum + a.totalAmount, 0)
}

export function totalSpent(ledger: FinanceLedger): number {
  return ledger.spends.reduce((sum, s) => sum + s.amount, 0)
}

export function emptyFinanceLedger(billsId: string): FinanceLedger {
  return {
    categories: [
      {
        id: billsId,
        name: 'Bills',
        frequency: 'monthly',
        amount: 0,
        isPreset: true,
      },
    ],
    allocations: [],
    spends: [],
  }
}

export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export { startOfWeekMonday }
