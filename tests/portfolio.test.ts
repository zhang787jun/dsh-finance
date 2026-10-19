import { describe, expect, it } from 'vitest'
import { analyzePortfolioRisk, type PortfolioPolicy } from '../src/portfolio.js'

describe('analyzePortfolioRisk', () => {
  it('computes gross, net, cash, position, and sector exposure', () => {
    const snapshot = analyzePortfolioRisk({
      netLiquidation: 100000,
      cash: 4000,
      positions: [
        { symbol: 'MSFT', marketValue: 30000, sector: 'Technology' },
        { symbol: 'GOOGL', marketValue: 25000, sector: 'Communication Services' },
        { symbol: 'SMH', marketValue: 20000, sector: 'Technology' },
        { symbol: 'HEDGE', marketValue: -10000, sector: 'Index Hedge' },
      ],
      maxPositionPct: 25,
      maxSectorPct: 40,
      minCashPct: 5,
    })

    expect(snapshot.grossExposurePct).toBe(85)
    expect(snapshot.netExposurePct).toBe(65)
    expect(snapshot.cashPct).toBe(4)
    expect(snapshot.largestPosition?.name).toBe('MSFT')
    expect(snapshot.sectorExposures[0]).toEqual({ name: 'Technology', marketValue: 50000, pct: 50 })
    expect(snapshot.flags).toContain('Cash 4% is below minimum 5%.')
    expect(snapshot.flags).toContain('MSFT is 30% of NAV, above maximum 25%.')
    expect(snapshot.flags).toContain('Technology sector exposure is 50% of NAV, above maximum 40%.')
  })

  it('derives NAV from positions and cash when not supplied', () => {
    const snapshot = analyzePortfolioRisk({
      cash: 10,
      positions: [{ symbol: 'A', marketValue: 90 }],
    })

    expect(snapshot.netLiquidation).toBe(100)
    expect(snapshot.grossExposurePct).toBe(90)
    expect(snapshot.cashPct).toBe(10)
  })

  it.each(['maxPositionPct', 'maxSectorPct', 'maxGrossExposurePct', 'minCashPct'] as const)('validates %s', key => {
    for (const value of [NaN, Infinity, -Infinity, -1]) {
      const policy: PortfolioPolicy = { [key]: value }
      expect(() => analyzePortfolioRisk({
        ...policy, netLiquidation: 100, positions: [{ symbol: 'A', marketValue: 10 }],
      })).toThrow(key)
    }
  })

  it('aggregates split positions before checking concentration', () => {
    const snapshot = analyzePortfolioRisk({
      netLiquidation: 100, cash: 70,
      positions: [{ symbol: ' A ', marketValue: 15 }, { symbol: 'A', marketValue: 15 }],
    })
    expect(snapshot.largestPosition).toEqual({ name: 'A', marketValue: 30, pct: 30 })
    expect(snapshot.flags).toContain('A is 30% of NAV, above maximum 20%.')
  })

  it('preserves gross risk across offsetting lots of the same symbol', () => {
    const snapshot = analyzePortfolioRisk({
      netLiquidation: 100, positions: [{ symbol: 'A', marketValue: 15 }, { symbol: 'A', marketValue: -15 }],
    })
    expect(snapshot.largestPosition).toEqual({ name: 'A', marketValue: 0, pct: 30 })
    expect(snapshot.grossExposure).toBe(30)
    expect(snapshot.netExposure).toBe(0)
    expect(snapshot.flags).toContain('A is 30% of NAV, above maximum 20%.')
  })

  it('reports every breached position and sector, not only the largest', () => {
    const snapshot = analyzePortfolioRisk({
      netLiquidation: 100, positions: [
        { symbol: 'A', marketValue: 45, sector: 'Technology' },
        { symbol: 'B', marketValue: -40, sector: 'Energy' },
      ],
    })
    expect(snapshot.flags).toEqual(expect.arrayContaining([
      'A is 45% of NAV, above maximum 20%.',
      'B is 40% of NAV, above maximum 20%.',
      'Technology sector exposure is 45% of NAV, above maximum 35%.',
      'Energy sector exposure is 40% of NAV, above maximum 35%.',
    ]))
  })

  it('checks concentration and cash limits before rounding percentages', () => {
    const snapshot = analyzePortfolioRisk({
      netLiquidation: 100000, cash: 4999, maxSectorPct: 20,
      positions: [{ symbol: 'A', marketValue: 20004, sector: 'Technology' }],
    })
    expect(snapshot.largestPosition?.pct).toBe(20)
    expect(snapshot.cashPct).toBe(5)
    expect(snapshot.flags).toEqual(expect.arrayContaining([
      'A is 20.004% of NAV, above maximum 20%.',
      'Technology sector exposure is 20.004% of NAV, above maximum 20%.',
      'Cash 4.999% is below minimum 5%.',
    ]))
  })

  it('checks gross exposure before rounding percentages', () => {
    const snapshot = analyzePortfolioRisk({
      netLiquidation: 100000, positions: [{ symbol: 'A', marketValue: 125004 }],
    })
    expect(snapshot.grossExposurePct).toBe(125)
    expect(snapshot.flags).toContain('Gross exposure 125.004% is above maximum 125%.')
  })

  it.each([7, 20, 29])('accepts exact policy boundaries (%s) and zero limits', limit => {
    const snapshot = analyzePortfolioRisk({
      netLiquidation: 100, cash: 0, minCashPct: 0,
      maxPositionPct: limit, maxSectorPct: limit, maxGrossExposurePct: limit,
      positions: [{ symbol: 'A', marketValue: limit }],
    })
    expect(snapshot.flags).toEqual([])
  })

  it('rejects aggregate overflow even when a finite NAV was supplied', () => {
    expect(() => analyzePortfolioRisk({
      netLiquidation: 100,
      positions: [{ symbol: 'A', marketValue: Number.MAX_VALUE }, { symbol: 'B', marketValue: -Number.MAX_VALUE }],
    })).toThrow('grossExposure must be a finite number')
  })

  it('rejects percentage overflow instead of reporting zero or infinity', () => {
    expect(() => analyzePortfolioRisk({
      netLiquidation: Number.MIN_VALUE, positions: [{ symbol: 'A', marketValue: 1 }],
    })).toThrow('exposure percentage must be a finite number')
  })
})
