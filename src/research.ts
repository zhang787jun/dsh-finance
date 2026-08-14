export const RESEARCH_WORKFLOWS = [
  'company_brief',
  'investment_memo',
  'valuation_snapshot',
  'risk_assessment',
  'earnings_quality',
  'catalyst_monitor',
  'sector_map',
  'macro_country',
] as const

export type ResearchWorkflow = typeof RESEARCH_WORKFLOWS[number]

export interface ResearchWorkflowArgs {
  target: string
  workflow?: ResearchWorkflow
  horizon?: string
  region?: string
  dataSources?: string[]
  requireCurrentSources?: boolean
}

export interface ResearchWorkflowPlan {
  target: string
  workflow: ResearchWorkflow
  horizon: string
  region: string
  dataSources: string[]
  sourcePolicy: string[]
  steps: string[]
  outputSections: string[]
  qualityGates: string[]
  disclaimer: string
}

const DEFAULT_DATA_SOURCES = [
  'latest company filings or exchange disclosures',
  'earnings transcripts and investor presentations',
  'price, estimates, and peer data with explicit timestamps',
  'reputable news and primary regulator releases',
]

const COMMON_SOURCE_POLICY = [
  'Do not state current prices, market caps, estimates, ratings, or ownership data unless a dated source is available in the current session.',
  'Separate source-backed facts from analysis, inference, and recommendation language.',
  'Carry stale, missing, or unavailable data forward as an explicit limitation instead of filling gaps from memory.',
  'Cite every material claim with a link or a local source path when the final answer is user-facing.',
]

const QUALITY_GATES = [
  'Entity is resolved unambiguously before analysis starts.',
  'The data timestamp is visible for every market-sensitive input.',
  'The conclusion names the two or three drivers that matter most.',
  'Risks include a falsifiable condition that would change the view.',
  'The output includes the informational-use disclaimer.',
]

const DISCLAIMER =
  'For research assistance only. This is not investment, legal, tax, or accounting advice and is not a recommendation to buy, sell, or hold any security.'

function normalizeWorkflow(value: string | undefined): ResearchWorkflow {
  if (value === undefined || value.trim() === '') return 'company_brief'
  const normalized = value.trim().toLowerCase().replaceAll('-', '_') as ResearchWorkflow
  if ((RESEARCH_WORKFLOWS as readonly string[]).includes(normalized)) return normalized
  throw new Error(`Unsupported research workflow: ${value}`)
}

function workflowSteps(workflow: ResearchWorkflow): string[] {
  switch (workflow) {
    case 'investment_memo':
      return [
        'Resolve the company or security and record the exact identifier used.',
        'Build the factual base from filings, transcripts, financial statements, price context, and relevant news.',
        'Identify the variant perception: where the view differs from consensus and why it matters.',
        'Assess earnings quality, balance sheet risk, moat durability, governance, and capital allocation before valuation.',
        'Select valuation methods that fit the business model, then cross-check with peers, history, and implied expectations.',
        'Build bull, base, and bear scenarios with probabilities, value ranges, catalysts, and risks.',
      ]
    case 'valuation_snapshot':
      return [
        'Resolve the security and confirm the share class, exchange, and currency.',
        'Collect current multiples, historical range, peer group, estimates, margins, and free cash flow context.',
        'Choose business-appropriate multiples and avoid generic P/E when a sector-specific metric is needed.',
        'State what the current price appears to embed, then compare that expectation with evidence.',
        'Return a cheap, fair, or rich verdict with the conditions that would change it.',
      ]
    case 'risk_assessment':
      return [
        'Resolve the entity and gather recent filings, risk factors, material events, and balance sheet data.',
        'Rate financial, competitive, operational, regulatory, macro, and governance risks by likelihood and impact.',
        'Run a distress screen when leverage, liquidity, coverage, or cash flow is stretched.',
        'Rank the two or three risks most likely to move intrinsic value or portfolio exposure.',
        'Name mitigants, warning indicators, and the next evidence to monitor.',
      ]
    case 'earnings_quality':
      return [
        'Collect income statement, cash flow, balance sheet, and segment data for comparable periods.',
        'Compare reported earnings with operating cash flow, accruals, receivables, inventory, margins, and one-time items.',
        'Identify accounting policy changes, unusual adjustments, and management language that needs verification.',
        'Classify the print as clean, mixed, or aggressive and explain the drivers.',
      ]
    case 'catalyst_monitor':
      return [
        'Resolve the target and build a forward calendar of earnings, product, regulatory, macro, and capital market events.',
        'Rank catalysts by likely impact, confidence, and date certainty.',
        'Explain what each event could confirm or invalidate about the current thesis.',
        'Define the watch list: numbers, dates, filings, transcripts, and market reactions to revisit.',
      ]
    case 'sector_map':
      return [
        'Define the sector boundary, geography, value chain, and investable universe.',
        'Map demand drivers, supply constraints, pricing power, regulation, substitution risk, and capital cycle position.',
        'Separate structural themes from cyclical noise and identify the companies most exposed to each driver.',
        'Return a ranked set of research questions and data sources for deeper work.',
      ]
    case 'macro_country':
      return [
        'Define the country, horizon, currency context, and market instruments affected.',
        'Collect growth, inflation, fiscal, monetary, external balance, credit, and political risk data.',
        'Connect macro conditions to sector or asset implications with explicit transmission channels.',
        'Name the data releases and policy events that would update the view.',
      ]
    case 'company_brief':
    default:
      return [
        'Resolve the company or security and record the exact identifier used.',
        'Collect material developments over the requested horizon across filings, earnings, products, partnerships, legal, regulatory, and management changes.',
        'Classify each development by source type, date, and business materiality.',
        'Explain the so-what for revenue, margins, balance sheet, competitive position, valuation, and risk.',
        'End with unresolved questions and the next source to check.',
      ]
  }
}

function outputSections(workflow: ResearchWorkflow): string[] {
  switch (workflow) {
    case 'investment_memo':
      return ['Executive view', 'Variant perception', 'Business quality', 'Valuation', 'Scenarios', 'Risks', 'Catalysts', 'Recommendation boundary', 'Sources']
    case 'valuation_snapshot':
      return ['Verdict', 'Key value drivers', 'Peer and history context', 'Implied expectations', 'What would change the view', 'Sources']
    case 'risk_assessment':
      return ['Top risks', 'Risk matrix', 'Financial health', 'Governance and controls', 'Mitigants', 'Monitoring plan', 'Sources']
    case 'earnings_quality':
      return ['Verdict', 'Cash conversion', 'Accruals and working capital', 'Adjustments', 'Red flags', 'Sources']
    case 'catalyst_monitor':
      return ['Catalyst calendar', 'Impact ranking', 'Thesis link', 'Watch points', 'Sources']
    case 'sector_map':
      return ['Sector boundary', 'Value chain', 'Structural drivers', 'Cyclical drivers', 'Company exposure map', 'Research queue', 'Sources']
    case 'macro_country':
      return ['Macro snapshot', 'Policy mix', 'External balance', 'Market transmission', 'Release calendar', 'Sources']
    case 'company_brief':
    default:
      return ['Summary', 'Material developments', 'So what', 'Risks and unknowns', 'Next checks', 'Sources']
  }
}

export function buildResearchWorkflow(args: ResearchWorkflowArgs): ResearchWorkflowPlan {
  const target = args.target.trim()
  if (target.length === 0) throw new Error('target is required')

  const workflow = normalizeWorkflow(args.workflow)
  const dataSources = args.dataSources?.filter(source => source.trim().length > 0) ?? DEFAULT_DATA_SOURCES

  return {
    target,
    workflow,
    horizon: args.horizon?.trim() || 'user-specified or most recent material period',
    region: args.region?.trim() || 'global unless the request narrows it',
    dataSources,
    sourcePolicy: args.requireCurrentSources === false
      ? COMMON_SOURCE_POLICY.slice(1)
      : COMMON_SOURCE_POLICY,
    steps: workflowSteps(workflow),
    outputSections: outputSections(workflow),
    qualityGates: QUALITY_GATES,
    disclaimer: DISCLAIMER,
  }
}
