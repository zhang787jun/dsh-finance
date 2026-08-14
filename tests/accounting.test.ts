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
    expect(result.flags[0]).toContain('requires an adjusting entry')
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
})
