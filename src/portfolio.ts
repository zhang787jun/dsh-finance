export interface PortfolioPosition {
  symbol: string
  marketValue: number
  sector?: string
  assetClass?: string
}

export interface PortfolioPolicy {
  maxPositionPct?: number
  maxSectorPct?: number
  maxGrossExposurePct?: number
  minCashPct?: number
}

export interface PortfolioRiskArgs extends PortfolioPolicy {
  positions: PortfolioPosition[]
  netLiquidation?: number
  cash?: number
}

export interface ExposureItem {
  name: string
  marketValue: number
  pct: number
}

export interface PortfolioRiskSnapshot {
  netLiquidation: number
  cash: number
  cashPct: number
  grossExposure: number
  grossExposurePct: number
  netExposure: number
  netExposurePct: number
  largestPosition: ExposureItem | null
  sectorExposures: ExposureItem[]
  flags: string[]
  notes: string[]
}

const DEFAULT_POLICY: Required<PortfolioPolicy> = {
  maxPositionPct: 20,
  maxSectorPct: 35,
  maxGrossExposurePct: 125,
  minCashPct: 5,
}

function pct(value: number, denominator: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(denominator) || denominator === 0) return 0
  return Number(((value / denominator) * 100).toFixed(2))
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
}

export function analyzePortfolioRisk(args: PortfolioRiskArgs): PortfolioRiskSnapshot {
  if (!Array.isArray(args.positions) || args.positions.length === 0) {
    throw new Error('positions must contain at least one position')
  }

  const positions = args.positions.map((position, index) => {
    const symbol = position.symbol.trim()
    if (symbol.length === 0) throw new Error(`positions[${index}].symbol is required`)
    assertFiniteNumber(position.marketValue, `positions[${index}].marketValue`)
    return {
      ...position,
      symbol,
      sector: position.sector?.trim() || 'Unclassified',
      assetClass: position.assetClass?.trim() || 'Equity',
    }
  })

  const cash = args.cash ?? 0
  assertFiniteNumber(cash, 'cash')

  const netPositionValue = positions.reduce((sum, position) => sum + position.marketValue, 0)
  const grossExposure = positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0)
  const netLiquidation = args.netLiquidation ?? (netPositionValue + cash)
  assertFiniteNumber(netLiquidation, 'netLiquidation')
  if (netLiquidation <= 0) throw new Error('netLiquidation must be positive')

  const policy: Required<PortfolioPolicy> = {
    maxPositionPct: args.maxPositionPct ?? DEFAULT_POLICY.maxPositionPct,
    maxSectorPct: args.maxSectorPct ?? DEFAULT_POLICY.maxSectorPct,
    maxGrossExposurePct: args.maxGrossExposurePct ?? DEFAULT_POLICY.maxGrossExposurePct,
    minCashPct: args.minCashPct ?? DEFAULT_POLICY.minCashPct,
  }

  const positionExposures = positions
    .map(position => ({
      name: position.symbol,
      marketValue: round(position.marketValue),
      pct: pct(Math.abs(position.marketValue), netLiquidation),
    }))
    .sort((a, b) => b.pct - a.pct)

  const sectorMap = new Map<string, number>()
  for (const position of positions) {
    sectorMap.set(position.sector, (sectorMap.get(position.sector) ?? 0) + Math.abs(position.marketValue))
  }
  const sectorExposures = [...sectorMap.entries()]
    .map(([name, marketValue]) => ({ name, marketValue: round(marketValue), pct: pct(marketValue, netLiquidation) }))
    .sort((a, b) => b.pct - a.pct)

  const cashPct = pct(cash, netLiquidation)
  const grossExposurePct = pct(grossExposure, netLiquidation)
  const netExposurePct = pct(netPositionValue, netLiquidation)
  const largestPosition = positionExposures[0] ?? null
  const largestSector = sectorExposures[0]
  const flags: string[] = []

  if (cashPct < policy.minCashPct) {
    flags.push(`Cash ${cashPct}% is below minimum ${policy.minCashPct}%.`)
  }
  if (grossExposurePct > policy.maxGrossExposurePct) {
    flags.push(`Gross exposure ${grossExposurePct}% is above maximum ${policy.maxGrossExposurePct}%.`)
  }
  if (largestPosition && largestPosition.pct > policy.maxPositionPct) {
    flags.push(`${largestPosition.name} is ${largestPosition.pct}% of NAV, above maximum ${policy.maxPositionPct}%.`)
  }
  if (largestSector && largestSector.pct > policy.maxSectorPct) {
    flags.push(`${largestSector.name} sector exposure is ${largestSector.pct}% of NAV, above maximum ${policy.maxSectorPct}%.`)
  }

  return {
    netLiquidation: round(netLiquidation),
    cash: round(cash),
    cashPct,
    grossExposure: round(grossExposure),
    grossExposurePct,
    netExposure: round(netPositionValue),
    netExposurePct,
    largestPosition,
    sectorExposures,
    flags,
    notes: [
      'Market values must come from user-provided or explicitly sourced portfolio data.',
      'Gross exposure uses absolute market value. Short positions should be entered as negative marketValue.',
      'This snapshot is a control check, not investment advice.',
    ],
  }
}
