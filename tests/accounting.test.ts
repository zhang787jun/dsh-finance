import { describe, expect, it } from 'vitest'
import { analyzeVarianceBridge, checkJournalEntry, reconcileAccount } from '../src/accounting.js'

describe('checkJournalEntry', () => {
  it('marks a documented balanced entry ready for review without authorizing posting', () => {
    const result = checkJournalEntry({
      period: '2026-07',
      currency: 'usd',
      preparedBy: 'Analyst',
      approvedBy: 'Controller',
      lines: [
        { accountCode: '6100', accountName: 'Software expense', debit: 1200, memo: 'July accrual' },
        { accountCode: '2200', accountName: 'Accrued liabilities', credit: 1200, memo: 'July accrual' },
      ],
    })

    expect(result.balanced).toBe(true)
    expect(result.readyForReview).toBe(true)
    expect(result.currency).toBe('USD')
    expect(result.postingAuthorized).toBe(false)
  })

  it('blocks an unbalanced entry and flags invalid lines', () => {
    const result = checkJournalEntry({
      lines: [
        { accountName: 'Expense', debit: 100, credit: 10 },
        { accountName: 'Liability', credit: 80 },
      ],
    })

    expect(result.balanced).toBe(false)
    expect(result.readyForReview).toBe(false)
    expect(result.blockingFlags).toContain('Line 1 has both debit and credit amounts.')
    expect(result.difference).toBe(10)
  })

  it('accepts one-cent entries at the default balance tolerance', () => {
    const result = checkJournalEntry({ lines: [
      { accountName: 'Expense', debit: 0.01 },
      { accountName: 'Cash', credit: 0.01 },
    ] })
    expect(result.readyForReview).toBe(true)
    expect(result.blockingFlags).toEqual([])
  })

  it.each([0.001, 0.01, 5])('blocks double-sided lines regardless of tolerance (credit %s)', credit => {
    const result = checkJournalEntry({ tolerance: 10, lines: [
      { accountName: 'Expense', debit: 100, credit },
      { accountName: 'Cash', credit: 100 - credit },
    ] })
    expect(result.readyForReview).toBe(false)
    expect(result.blockingFlags).toContain('Line 1 has both debit and credit amounts.')
  })

  it('blocks lines whose amounts round to zero even with zero tolerance', () => {
    const result = checkJournalEntry({ tolerance: 0, lines: [
      { accountName: 'Expense', debit: 0.004 },
      { accountName: 'Cash', credit: 0.004 },
    ] })
    expect(result.readyForReview).toBe(false)
  })

  it('rounds decimal half-cents consistently before totaling', () => {
    const result = checkJournalEntry({ tolerance: 0, lines: [
      { accountName: 'Expense', debit: 1.005 },
      { accountName: 'Cash', credit: 1.01 },
    ] })
    expect(result.totalDebit).toBe(1.01)
    expect(result.difference).toBe(0)
    expect(result.readyForReview).toBe(true)
  })

  it('rejects totals outside the safe monetary range', () => {
    expect(() => checkJournalEntry({ lines: [
      { accountName: 'Expense A', debit: 50_000_000_000_000 },
      { accountName: 'Expense B', debit: 50_000_000_000_000 },
      { accountName: 'Cash', credit: 1 },
    ] })).toThrow('totalDebit exceeds the safe monetary range')
  })
})

describe('reconcileAccount', () => {
  it('reconciles normal timing items and keeps human sign-off separate', () => {
    const result = reconcileAccount({
      bookBalance: 1000,
      sourceBalance: 990,
      asOfDate: '2026-07-31',
      items: [
        {
          description: 'Deposit in transit',
          amount: 10,
          appliesTo: 'source',
          category: 'timing',
          originatedDate: '2026-07-31',
        },
      ],
    })

    expect(result.adjustedSourceBalance).toBe(1000)
    expect(result.reconciled).toBe(true)
    expect(result.signOffReady).toBe(true)
    expect(result.signOffAuthorized).toBe(false)
  })

  it('does not mark an unposted adjustment as ready for sign-off', () => {
    const result = reconcileAccount({
      bookBalance: 990,
      sourceBalance: 1000,
      items: [
        {
          description: 'Interest not recorded in GL',
          amount: 10,
          appliesTo: 'book',
          category: 'adjustment_required',
        },
      ],
    })

    expect(result.reconciled).toBe(true)
    expect(result.signOffReady).toBe(false)
    expect(result.flags.some(flag => flag.includes('requires an adjusting entry'))).toBe(true)
  })

  it('blocks sign-off for stale investigation items', () => {
    const result = reconcileAccount({
      bookBalance: 1000,
      sourceBalance: 1000,
      asOfDate: '2026-07-31',
      items: [
        {
          description: 'Unidentified legacy item',
          amount: 0,
          appliesTo: 'book',
          category: 'investigation',
          originatedDate: '2026-01-01',
        },
      ],
    })

    expect(result.reconciled).toBe(true)
    expect(result.signOffReady).toBe(false)
    expect(result.flags.some(flag => flag.includes('stale'))).toBe(true)
  })

  it('rejects impossible calendar dates', () => {
    expect(() => reconcileAccount({
      bookBalance: 100,
      sourceBalance: 100,
      asOfDate: '2026-02-30',
    })).toThrow('asOfDate is not a valid calendar date')
  })

  it.each([
    { asOfDate: undefined, originatedDate: '2026-07-31' },
    { asOfDate: '2026-07-31', originatedDate: undefined },
    { asOfDate: undefined, originatedDate: undefined },
  ])('blocks sign-off when aging cannot be assessed (%j)', dates => {
    const result = reconcileAccount({
      bookBalance: 100, sourceBalance: 90, asOfDate: dates.asOfDate,
      items: [{ description: 'Deposit', amount: 10, appliesTo: 'source', category: 'timing', originatedDate: dates.originatedDate }],
    })
    expect(result.reconciled).toBe(true)
    expect(result.items[0].ageDays).toBeNull()
    expect(result.signOffReady).toBe(false)
    expect(result.flags.some(flag => flag.includes('aging'))).toBe(true)
    expect(result.signOffAuthorized).toBe(false)
  })

  it('does not require item aging for an account with no reconciling items', () => {
    const result = reconcileAccount({ bookBalance: 100, sourceBalance: 100 })
    expect(result.signOffReady).toBe(true)
  })

  it('uses the same rounded amounts for category totals and adjusted balances', () => {
    const result = reconcileAccount({
      bookBalance: 1.005, sourceBalance: 1.025, tolerance: 0, asOfDate: '2026-07-31',
      items: ['A', 'B'].map(description => ({
        description, amount: 0.005, appliesTo: 'book' as const,
        category: 'timing' as const, originatedDate: '2026-07-31',
      })),
    })
    expect(result.bookBalance).toBe(1.01)
    expect(result.items.map(item => item.amount)).toEqual([0.01, 0.01])
    expect(result.categoryTotals.timing).toBe(0.02)
    expect(result.bookAdjustments).toBe(0.02)
    expect(result.adjustedBookBalance).toBe(1.03)
    expect(result.adjustedSourceBalance).toBe(1.03)
    expect(result.reconciled).toBe(true)
  })

  it('blocks future-dated timing items', () => {
    const result = reconcileAccount({
      bookBalance: 100, sourceBalance: 90, asOfDate: '2026-07-31',
      items: [{ description: 'Deposit', amount: 10, appliesTo: 'source', category: 'timing', originatedDate: '2026-08-01' }],
    })
    expect(result.signOffReady).toBe(false)
    expect(result.items[0].ageDays).toBe(-1)
  })
})

describe('analyzeVarianceBridge', () => {
  it('reconciles drivers to the actual result and evaluates materiality', () => {
    const result = analyzeVarianceBridge({
      baseValue: 500_000,
      actualValue: 528_000,
      dollarMateriality: 25_000,
      percentMateriality: 10,
      drivers: [
        { name: 'Volume', amount: 50_000 },
        { name: 'Price', amount: -22_000 },
      ],
    })

    expect(result.totalVariance).toBe(28_000)
    expect(result.residual).toBe(0)
    expect(result.reconciled).toBe(true)
    expect(result.materiality.triggered).toBe(true)
    expect(result.direction).toBe('increase')
  })

  it('carries an unreconciled residual explicitly', () => {
    const result = analyzeVarianceBridge({
      baseValue: 100,
      actualValue: 120,
      drivers: [{ name: 'Known driver', amount: 15 }],
    })

    expect(result.reconciled).toBe(false)
    expect(result.residual).toBe(5)
    expect(result.flags[0]).toContain('unreconciled residual')
  })

  it.each([1, -1])('keeps rounded endpoints, drivers, cumulative values and residuals consistent (sign %s)', sign => {
    const result = analyzeVarianceBridge({
      baseValue: sign * 0.005, actualValue: sign * 0.015, tolerance: 0,
      drivers: [{ name: 'Change', amount: sign * 0.005 }],
    })
    expect(result.baseValue).toBe(sign * 0.01)
    expect(result.actualValue).toBe(sign * 0.02)
    expect(result.totalVariance).toBe(sign * 0.01)
    expect(result.driverTotal).toBe(sign * 0.01)
    expect(result.drivers[0].cumulative).toBe(result.actualValue)
    expect(result.drivers[0].pctOfVariance).toBe(100)
    expect(result.percentVariance).toBe(sign * 100)
    expect(result.residual).toBe(0)
    expect(result.reconciled).toBe(true)
  })

  it('treats a base rounded to zero as unavailable for percentage variance', () => {
    const result = analyzeVarianceBridge({
      baseValue: 0.004, actualValue: 0.014,
      drivers: [{ name: 'Change', amount: 0.01 }],
    })
    expect(result.baseValue).toBe(0)
    expect(result.percentVariance).toBeNull()
  })

  it.each([
    { actualValue: 10999.6, triggered: false },
    { actualValue: 11000, triggered: true },
  ])('evaluates percentage materiality before display rounding (%j)', ({ actualValue, triggered }) => {
    const result = analyzeVarianceBridge({
      baseValue: 10000, actualValue, percentMateriality: 10,
      drivers: [{ name: 'Change', amount: actualValue - 10000 }],
    })
    expect(result.percentVariance).toBe(10)
    expect(result.materiality.triggered).toBe(triggered)
  })

  it('rejects unsafe monetary inputs instead of emitting non-finite JSON values', () => {
    expect(() => analyzeVarianceBridge({
      baseValue: -Number.MAX_VALUE, actualValue: Number.MAX_VALUE,
      drivers: [{ name: 'Change', amount: 1 }],
    })).toThrow('safe monetary range')
  })

  it('recognizes an exact materiality threshold despite binary percentage noise', () => {
    const result = analyzeVarianceBridge({
      baseValue: 100, actualValue: 129, percentMateriality: 29,
      drivers: [{ name: 'Change', amount: 29 }],
    })
    expect(result.materiality.triggered).toBe(true)
  })
})
