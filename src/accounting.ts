import { addCents, fromCents, toCents } from './money.js'
import { exceedsThreshold } from './thresholds.js'

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
  let debitCents = 0
  let creditCents = 0

  const lines = args.lines.map((line, index) => {
    const lineNumber = index + 1
    const accountName = line.accountName.trim()
    if (accountName.length === 0) throw new Error(`lines[${index}].accountName is required`)

    const debit = line.debit ?? 0
    const credit = line.credit ?? 0
    assertFiniteNumber(debit, `lines[${index}].debit`)
    assertFiniteNumber(credit, `lines[${index}].credit`)
    if (debit < 0 || credit < 0) throw new Error(`lines[${index}] debit and credit must be non-negative`)

    const lineDebitCents = toCents(debit, `lines[${index}].debit`)
    const lineCreditCents = toCents(credit, `lines[${index}].credit`)
    debitCents = addCents(debitCents, lineDebitCents, 'totalDebit')
    creditCents = addCents(creditCents, lineCreditCents, 'totalCredit')

    // Tolerance applies to the entry's balance, never to its line structure.
    if (debit > 0 && credit > 0) {
      blockingFlags.push(`Line ${lineNumber} has both debit and credit amounts.`)
    } else if (lineDebitCents === 0 && lineCreditCents === 0) {
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
      debit: fromCents(lineDebitCents),
      credit: fromCents(lineCreditCents),
    }
  })

  const totalDebit = fromCents(debitCents)
  const totalCredit = fromCents(creditCents)
  const difference = fromCents(addCents(debitCents, -creditCents, 'difference'))
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
  const bookCents = toCents(args.bookBalance, 'bookBalance')
  const sourceCents = toCents(args.sourceBalance, 'sourceBalance')
  const tolerance = nonNegative(args.tolerance, 0.01, 'tolerance')
  const staleAfterDays = nonNegative(args.staleAfterDays, 90, 'staleAfterDays')
  const asOfTimestamp = args.asOfDate ? parseDate(args.asOfDate, 'asOfDate') : null
  const flags: string[] = []
  const categoryCents: Record<ReconciliationCategory, number> = {
    timing: 0,
    adjustment_required: 0,
    investigation: 0,
  }
  let bookAdjustmentCents = 0
  let sourceAdjustmentCents = 0
  if (args.items?.length && asOfTimestamp === null) {
    flags.push('An as-of date is required to assess item aging before sign-off.')
  }

  const items = (args.items ?? []).map((item, index) => {
    const description = item.description.trim()
    if (description.length === 0) throw new Error(`items[${index}].description is required`)
    const amountCents = toCents(item.amount, `items[${index}].amount`)
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
    } else {
      flags.push(`${description} is missing an originated date; aging is unavailable.`)
    }
    const stale = ageDays !== null && ageDays > staleAfterDays
    if (stale) flags.push(`${description} is stale at ${ageDays} days.`)
    if (item.category === 'adjustment_required') {
      flags.push(`${description} requires an adjusting entry before sign-off.`)
    }
    if (item.category === 'investigation') flags.push(`${description} remains under investigation.`)
    categoryCents[item.category] = addCents(categoryCents[item.category], amountCents, `${item.category} total`)
    if (item.appliesTo === 'book') {
      bookAdjustmentCents = addCents(bookAdjustmentCents, amountCents, 'bookAdjustments')
    } else {
      sourceAdjustmentCents = addCents(sourceAdjustmentCents, amountCents, 'sourceAdjustments')
    }

    return {
      ...item,
      description,
      owner: item.owner?.trim() || undefined,
      amount: fromCents(amountCents),
      ageDays,
      stale,
    }
  })

  const adjustedBookCents = addCents(bookCents, bookAdjustmentCents, 'adjustedBookBalance')
  const adjustedSourceCents = addCents(sourceCents, sourceAdjustmentCents, 'adjustedSourceBalance')
  const difference = fromCents(addCents(adjustedBookCents, -adjustedSourceCents, 'difference'))
  const reconciled = Math.abs(difference) <= tolerance
  if (!reconciled) flags.push(`Adjusted balances differ by ${Math.abs(difference).toFixed(2)}.`)

  return {
    bookBalance: fromCents(bookCents),
    sourceBalance: fromCents(sourceCents),
    bookAdjustments: fromCents(bookAdjustmentCents),
    sourceAdjustments: fromCents(sourceAdjustmentCents),
    adjustedBookBalance: fromCents(adjustedBookCents),
    adjustedSourceBalance: fromCents(adjustedSourceCents),
    difference,
    reconciled,
    signOffReady: reconciled && !items.some(item =>
      item.category !== 'timing' || item.stale || item.ageDays === null || item.ageDays < 0),
    items,
    categoryTotals: {
      timing: fromCents(categoryCents.timing),
      adjustment_required: fromCents(categoryCents.adjustment_required),
      investigation: fromCents(categoryCents.investigation),
    },
    flags,
    signOffAuthorized: false,
  }
}

export function analyzeVarianceBridge(args: VarianceBridgeArgs): VarianceBridgeResult {
  const baseCents = toCents(args.baseValue, 'baseValue')
  const actualCents = toCents(args.actualValue, 'actualValue')
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
  const varianceCents = addCents(actualCents, -baseCents, 'totalVariance')
  const totalVariance = fromCents(varianceCents)
  const rawPercentVariance = baseCents === 0
    ? null
    : (varianceCents / Math.abs(baseCents)) * 100
  const percentVariance = rawPercentVariance === null ? null : round(rawPercentVariance)
  const flags: string[] = []
  const seenNames = new Set<string>()
  let cumulativeCents = baseCents
  let driverCents = 0

  const drivers = args.drivers.map((driver, index) => {
    const name = driver.name.trim()
    if (name.length === 0) throw new Error(`drivers[${index}].name is required`)
    const amountCents = toCents(driver.amount, `drivers[${index}].amount`)
    const normalizedName = name.toLowerCase()
    if (seenNames.has(normalizedName)) flags.push(`Duplicate driver name: ${name}.`)
    seenNames.add(normalizedName)
    cumulativeCents = addCents(cumulativeCents, amountCents, 'cumulative')
    driverCents = addCents(driverCents, amountCents, 'driverTotal')
    return {
      name,
      amount: fromCents(amountCents),
      cumulative: fromCents(cumulativeCents),
      pctOfVariance: varianceCents === 0 ? null : round((amountCents / varianceCents) * 100),
    }
  })

  const driverTotal = fromCents(driverCents)
  const residual = fromCents(addCents(varianceCents, -driverCents, 'residual'))
  const reconciled = Math.abs(residual) <= tolerance
  if (!reconciled) flags.push(`Variance bridge has an unreconciled residual of ${residual.toFixed(2)}.`)
  if (percentVariance === null) flags.push('Percentage variance is unavailable because the base value is zero.')

  const reasons: string[] = []
  if (dollarThreshold !== null && Math.abs(totalVariance) >= dollarThreshold) {
    reasons.push(`Absolute variance meets the ${dollarThreshold.toFixed(2)} dollar threshold.`)
  }
  if (percentThreshold !== null && rawPercentVariance !== null && !exceedsThreshold(percentThreshold, Math.abs(rawPercentVariance))) {
    reasons.push(`Absolute percentage variance meets the ${percentThreshold.toFixed(2)}% threshold.`)
  }

  return {
    baseValue: fromCents(baseCents),
    actualValue: fromCents(actualCents),
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
