export interface JournalEntryLine {
  accountCode?: string
  accountName: string
  debit?: number
  credit?: number
  department?: string
  memo?: string
}

export interface JournalEntryCheckArgs {
  lines: JournalEntryLine[]
  period?: string
  currency?: string
  tolerance?: number
  preparedBy?: string
  approvedBy?: string
}

export interface JournalEntryCheckResult {
  period: string | null
  currency: string
  lines: Array<JournalEntryLine & { line: number, debit: number, credit: number }>
  totalDebit: number
  totalCredit: number
  difference: number
  balanced: boolean
  readyForReview: boolean
  blockingFlags: string[]
  reviewFlags: string[]
  postingAuthorized: false
}

export const RECONCILIATION_CATEGORIES = [
  'timing',
  'adjustment_required',
  'investigation',
] as const

export type ReconciliationCategory = typeof RECONCILIATION_CATEGORIES[number]
export type ReconciliationSide = 'book' | 'source'

export interface ReconcilingItem {
  description: string
  amount: number
  appliesTo: ReconciliationSide
  category: ReconciliationCategory
  originatedDate?: string
  owner?: string
}

export interface ReconciliationArgs {
  bookBalance: number
  sourceBalance: number
  items?: ReconcilingItem[]
  asOfDate?: string
  tolerance?: number
  staleAfterDays?: number
}

export interface ReconciliationResult {
  bookBalance: number
  sourceBalance: number
  bookAdjustments: number
  sourceAdjustments: number
  adjustedBookBalance: number
  adjustedSourceBalance: number
  difference: number
  reconciled: boolean
  signOffReady: boolean
  items: Array<ReconcilingItem & { ageDays: number | null, stale: boolean }>
  categoryTotals: Record<ReconciliationCategory, number>
  flags: string[]
  signOffAuthorized: false
}

export interface VarianceDriver {
  name: string
  amount: number
}

export interface VarianceBridgeArgs {
  baseValue: number
  actualValue: number
  drivers: VarianceDriver[]
  tolerance?: number
  dollarMateriality?: number
  percentMateriality?: number
}

export interface VarianceBridgeResult {
  baseValue: number
  actualValue: number
  totalVariance: number
  percentVariance: number | null
  direction: 'increase' | 'decrease' | 'flat'
  driverTotal: number
  residual: number
  reconciled: boolean
  drivers: Array<VarianceDriver & { cumulative: number, pctOfVariance: number | null }>
  materiality: {
    dollarThreshold: number | null
    percentThreshold: number | null
    triggered: boolean
    reasons: string[]
  }
  flags: string[]
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
}

function nonNegative(value: number | undefined, fallback: number, name: string): number {
  const normalized = value ?? fallback
  assertFiniteNumber(normalized, name)
  if (normalized < 0) throw new Error(`${name} must be non-negative`)
  return normalized
}

function parseDate(value: string, name: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`)
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp)) throw new Error(`${name} is not a valid date`)
  if (new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} is not a valid calendar date`)
  }
  return timestamp
}

export function checkJournalEntry(args: JournalEntryCheckArgs): JournalEntryCheckResult {
  if (!Array.isArray(args.lines) || args.lines.length < 2) {
    throw new Error('lines must contain at least two journal entry lines')
  }

  const tolerance = nonNegative(args.tolerance, 0.01, 'tolerance')
  const blockingFlags: string[] = []
  const reviewFlags: string[] = []

  const lines = args.lines.map((line, index) => {
    const lineNumber = index + 1
    const accountName = line.accountName.trim()
    if (accountName.length === 0) throw new Error(`lines[${index}].accountName is required`)

    const debit = line.debit ?? 0
    const credit = line.credit ?? 0
    assertFiniteNumber(debit, `lines[${index}].debit`)
    assertFiniteNumber(credit, `lines[${index}].credit`)
    if (debit < 0 || credit < 0) throw new Error(`lines[${index}] debit and credit must be non-negative`)

    if (debit > tolerance && credit > tolerance) {
      blockingFlags.push(`Line ${lineNumber} has both debit and credit amounts.`)
    } else if (debit <= tolerance && credit <= tolerance) {
      blockingFlags.push(`Line ${lineNumber} has no debit or credit amount.`)
    }
    if (!line.accountCode?.trim()) reviewFlags.push(`Line ${lineNumber} is missing an account code.`)
    if (!line.memo?.trim()) reviewFlags.push(`Line ${lineNumber} is missing a memo.`)

    return {
      ...line,
      line: lineNumber,
      accountName,
      accountCode: line.accountCode?.trim() || undefined,
      department: line.department?.trim() || undefined,
      memo: line.memo?.trim() || undefined,
      debit: round(debit),
      credit: round(credit),
    }
  })

  const totalDebit = round(lines.reduce((sum, line) => sum + line.debit, 0))
  const totalCredit = round(lines.reduce((sum, line) => sum + line.credit, 0))
  const difference = round(totalDebit - totalCredit)
  const balanced = Math.abs(difference) <= tolerance
  if (!balanced) blockingFlags.push(`Entry is out of balance by ${Math.abs(difference).toFixed(2)}.`)

  const preparedBy = args.preparedBy?.trim()
  const approvedBy = args.approvedBy?.trim()
  if (preparedBy && approvedBy && preparedBy.toLowerCase() === approvedBy.toLowerCase()) {
    reviewFlags.push('Preparer and approver are the same person; verify segregation of duties.')
  }

  return {
    period: args.period?.trim() || null,
    currency: args.currency?.trim().toUpperCase() || 'USD',
    lines,
    totalDebit,
    totalCredit,
    difference,
    balanced,
    readyForReview: balanced && blockingFlags.length === 0,
    blockingFlags,
    reviewFlags,
    postingAuthorized: false,
  }
}

export function reconcileAccount(args: ReconciliationArgs): ReconciliationResult {
  assertFiniteNumber(args.bookBalance, 'bookBalance')
  assertFiniteNumber(args.sourceBalance, 'sourceBalance')
  const tolerance = nonNegative(args.tolerance, 0.01, 'tolerance')
  const staleAfterDays = nonNegative(args.staleAfterDays, 90, 'staleAfterDays')
  const asOfTimestamp = args.asOfDate ? parseDate(args.asOfDate, 'asOfDate') : null
  const flags: string[] = []
  const categoryTotals: Record<ReconciliationCategory, number> = {
    timing: 0,
    adjustment_required: 0,
    investigation: 0,
  }

  const items = (args.items ?? []).map((item, index) => {
    const description = item.description.trim()
    if (description.length === 0) throw new Error(`items[${index}].description is required`)
    assertFiniteNumber(item.amount, `items[${index}].amount`)
    if (item.appliesTo !== 'book' && item.appliesTo !== 'source') {
      throw new Error(`items[${index}].appliesTo must be book or source`)
    }
    if (!(RECONCILIATION_CATEGORIES as readonly string[]).includes(item.category)) {
      throw new Error(`items[${index}].category is unsupported`)
    }

    let ageDays: number | null = null
    if (item.originatedDate) {
      const originatedTimestamp = parseDate(item.originatedDate, `items[${index}].originatedDate`)
      if (asOfTimestamp !== null) {
        ageDays = Math.floor((asOfTimestamp - originatedTimestamp) / 86_400_000)
        if (ageDays < 0) flags.push(`${description} has an originated date after the as-of date.`)
      }
    }
    const stale = ageDays !== null && ageDays > staleAfterDays
    if (stale) flags.push(`${description} is stale at ${ageDays} days.`)
    if (item.category === 'adjustment_required') {
      flags.push(`${description} requires an adjusting entry before sign-off.`)
    }
    if (item.category === 'investigation') flags.push(`${description} remains under investigation.`)
    categoryTotals[item.category] = round(categoryTotals[item.category] + item.amount)

    return {
      ...item,
      description,
      owner: item.owner?.trim() || undefined,
      amount: round(item.amount),
      ageDays,
      stale,
    }
  })

  const bookAdjustments = round(items
    .filter(item => item.appliesTo === 'book')
    .reduce((sum, item) => sum + item.amount, 0))
  const sourceAdjustments = round(items
    .filter(item => item.appliesTo === 'source')
    .reduce((sum, item) => sum + item.amount, 0))
  const adjustedBookBalance = round(args.bookBalance + bookAdjustments)
  const adjustedSourceBalance = round(args.sourceBalance + sourceAdjustments)
  const difference = round(adjustedBookBalance - adjustedSourceBalance)
  const reconciled = Math.abs(difference) <= tolerance
  if (!reconciled) flags.push(`Adjusted balances differ by ${Math.abs(difference).toFixed(2)}.`)

  return {
    bookBalance: round(args.bookBalance),
    sourceBalance: round(args.sourceBalance),
    bookAdjustments,
    sourceAdjustments,
    adjustedBookBalance,
    adjustedSourceBalance,
    difference,
    reconciled,
    signOffReady: reconciled && !items.some(item =>
      item.category !== 'timing' || item.stale || (item.ageDays !== null && item.ageDays < 0)),
    items,
    categoryTotals,
    flags,
    signOffAuthorized: false,
  }
}

export function analyzeVarianceBridge(args: VarianceBridgeArgs): VarianceBridgeResult {
  assertFiniteNumber(args.baseValue, 'baseValue')
  assertFiniteNumber(args.actualValue, 'actualValue')
  if (!Array.isArray(args.drivers) || args.drivers.length === 0) {
    throw new Error('drivers must contain at least one variance driver')
  }

  const tolerance = nonNegative(args.tolerance, 0.01, 'tolerance')
  const dollarThreshold = args.dollarMateriality === undefined
    ? null
    : nonNegative(args.dollarMateriality, 0, 'dollarMateriality')
  const percentThreshold = args.percentMateriality === undefined
    ? null
    : nonNegative(args.percentMateriality, 0, 'percentMateriality')
  const totalVariance = round(args.actualValue - args.baseValue)
  const percentVariance = args.baseValue === 0
    ? null
    : round((totalVariance / Math.abs(args.baseValue)) * 100)
  const flags: string[] = []
  const seenNames = new Set<string>()
  let cumulative = round(args.baseValue)

  const drivers = args.drivers.map((driver, index) => {
    const name = driver.name.trim()
    if (name.length === 0) throw new Error(`drivers[${index}].name is required`)
    assertFiniteNumber(driver.amount, `drivers[${index}].amount`)
    const normalizedName = name.toLowerCase()
    if (seenNames.has(normalizedName)) flags.push(`Duplicate driver name: ${name}.`)
    seenNames.add(normalizedName)
    cumulative = round(cumulative + driver.amount)
    return {
      name,
      amount: round(driver.amount),
      cumulative,
      pctOfVariance: totalVariance === 0 ? null : round((driver.amount / totalVariance) * 100),
    }
  })

  const driverTotal = round(drivers.reduce((sum, driver) => sum + driver.amount, 0))
  const residual = round(totalVariance - driverTotal)
  const reconciled = Math.abs(residual) <= tolerance
  if (!reconciled) flags.push(`Variance bridge has an unreconciled residual of ${residual.toFixed(2)}.`)
  if (percentVariance === null) flags.push('Percentage variance is unavailable because the base value is zero.')

  const reasons: string[] = []
  if (dollarThreshold !== null && Math.abs(totalVariance) >= dollarThreshold) {
    reasons.push(`Absolute variance meets the ${dollarThreshold.toFixed(2)} dollar threshold.`)
  }
  if (percentThreshold !== null && percentVariance !== null && Math.abs(percentVariance) >= percentThreshold) {
    reasons.push(`Absolute percentage variance meets the ${percentThreshold.toFixed(2)}% threshold.`)
  }

  return {
    baseValue: round(args.baseValue),
    actualValue: round(args.actualValue),
    totalVariance,
    percentVariance,
    direction: totalVariance > tolerance ? 'increase' : totalVariance < -tolerance ? 'decrease' : 'flat',
    driverTotal,
    residual,
    reconciled,
    drivers,
    materiality: {
      dollarThreshold,
      percentThreshold,
      triggered: reasons.length > 0,
      reasons,
    },
    flags,
  }
}
