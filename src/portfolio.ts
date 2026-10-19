import { exceedsThreshold } from './thresholds.js'

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
  assertFiniteNumber(value, 'exposure')
  const result = (value / denominator) * 100
  assertFiniteNumber(result, 'exposure percentage')
  return result
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
}

function displayPct(value: number): number {
  return Number(value.toPrecision(12))
}

function roundedExposure(item: ExposureItem): ExposureItem {
  return { ...item, marketValue: round(item.marketValue), pct: round(item.pct) }
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
  assertFiniteNumber(netPositionValue, 'netExposure')
  assertFiniteNumber(grossExposure, 'grossExposure')
  const netLiquidation = args.netLiquidation ?? (netPositionValue + cash)
  assertFiniteNumber(netLiquidation, 'netLiquidation')
  if (netLiquidation <= 0) throw new Error('netLiquidation must be positive')

  const policy: Required<PortfolioPolicy> = {
    maxPositionPct: args.maxPositionPct ?? DEFAULT_POLICY.maxPositionPct,
    maxSectorPct: args.maxSectorPct ?? DEFAULT_POLICY.maxSectorPct,
    maxGrossExposurePct: args.maxGrossExposurePct ?? DEFAULT_POLICY.maxGrossExposurePct,
    minCashPct: args.minCashPct ?? DEFAULT_POLICY.minCashPct,
  }
  for (const [name, value] of Object.entries(policy)) {
    assertFiniteNumber(value, name)
    if (value < 0) throw new Error(`${name} must be non-negative`)
  }

  // A position split across lots/accounts must still trigger concentration checks.
  const positionMap = new Map<string, { marketValue: number, grossValue: number }>()
  const sectorMap = new Map<string, number>()
  for (const position of positions) {
    const exposure = positionMap.get(position.symbol) ?? { marketValue: 0, grossValue: 0 }
    exposure.marketValue += position.marketValue
    exposure.grossValue += Math.abs(position.marketValue)
    positionMap.set(position.symbol, exposure)
    sectorMap.set(position.sector, (sectorMap.get(position.sector) ?? 0) + Math.abs(position.marketValue))
  }
  const positionExposures = [...positionMap.entries()]
    .map(([name, exposure]) => ({
      name,
      marketValue: exposure.marketValue,
      pct: pct(exposure.grossValue, netLiquidation),
    }))
    .sort((a, b) => b.pct - a.pct)
  const sectorExposures = [...sectorMap.entries()]
    .map(([name, marketValue]) => ({ name, marketValue, pct: pct(marketValue, netLiquidation) }))
    .sort((a, b) => b.pct - a.pct)

  const cashPct = pct(cash, netLiquidation)
  const grossExposurePct = pct(grossExposure, netLiquidation)
  const netExposurePct = pct(netPositionValue, netLiquidation)
  const largestPosition = positionExposures[0] ?? null
  const flags: string[] = []

  if (exceedsThreshold(policy.minCashPct, cashPct)) {
    flags.push(`Cash ${displayPct(cashPct)}% is below minimum ${policy.minCashPct}%.`)
  }
  if (exceedsThreshold(grossExposurePct, policy.maxGrossExposurePct)) {
    flags.push(`Gross exposure ${displayPct(grossExposurePct)}% is above maximum ${policy.maxGrossExposurePct}%.`)
  }
  for (const position of positionExposures) {
    if (exceedsThreshold(position.pct, policy.maxPositionPct)) {
      flags.push(`${position.name} is ${displayPct(position.pct)}% of NAV, above maximum ${policy.maxPositionPct}%.`)
    }
  }
  for (const sector of sectorExposures) {
    if (exceedsThreshold(sector.pct, policy.maxSectorPct)) {
      flags.push(`${sector.name} sector exposure is ${displayPct(sector.pct)}% of NAV, above maximum ${policy.maxSectorPct}%.`)
    }
  }

  return {
    netLiquidation: round(netLiquidation),
    cash: round(cash),
    cashPct: round(cashPct),
    grossExposure: round(grossExposure),
    grossExposurePct: round(grossExposurePct),
    netExposure: round(netPositionValue),
    netExposurePct: round(netExposurePct),
    largestPosition: largestPosition ? roundedExposure(largestPosition) : null,
    sectorExposures: sectorExposures.map(roundedExposure),
    flags,
    notes: [
      'Market values must come from user-provided or explicitly sourced portfolio data.',
      'Gross exposure uses absolute market value. Short positions should be entered as negative marketValue.',
      'Repeated symbols are aggregated. Position marketValue is net; concentration percentages use gross absolute value without netting long and short lots.',
      'Limits are checked before percentages are rounded for display.',
      'This snapshot is a control check, not investment advice.',
    ],
  }
}
