import { describe, expect, it } from 'vitest'
import { analyzePortfolioRisk } from '../src/portfolio.js'

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
})
