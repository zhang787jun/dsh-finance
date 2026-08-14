/** Finance, accounting, research, and portfolio-risk workflow tools for DeepSeek Harness. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-skill'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  analyzeVarianceBridge,
  checkJournalEntry,
  reconcileAccount,
  RECONCILIATION_CATEGORIES,
  type JournalEntryCheckArgs,
  type ReconciliationArgs,
  type VarianceBridgeArgs,
} from './accounting.js'
import { analyzePortfolioRisk, type PortfolioRiskArgs } from './portfolio.js'
import { buildResearchWorkflow, RESEARCH_WORKFLOWS, type ResearchWorkflowArgs } from './research.js'

export const name = 'finance'
export const inject = ['skills', 'tools']

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url))

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

function skillContent(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function renderJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function toJsonRecord(value: unknown): { [key: string]: JsonValue } {
  return JSON.parse(JSON.stringify(value)) as { [key: string]: JsonValue }
}

const BUNDLED_SKILLS = [
  {
    name: 'dsh-finance-journal-entry',
    description: 'Prepare balanced journal entries with support, review controls, and explicit human posting authority.',
    path: 'skills/dsh-finance-journal-entry/SKILL.md',
  },
  {
    name: 'dsh-finance-journal-entry-prep',
    description: 'Apply accounting guidance for accruals, prepaids, depreciation, payroll, revenue, and manual entries.',
    path: 'skills/dsh-finance-journal-entry-prep/SKILL.md',
  },
  {
    name: 'dsh-finance-reconciliation',
    description: 'Reconcile GL, subledger, bank, and intercompany balances with aging and escalation controls.',
    path: 'skills/dsh-finance-reconciliation/SKILL.md',
  },
  {
    name: 'dsh-finance-financial-statements',
    description: 'Prepare income statements, balance sheets, and cash flow statements with comparison and variance review.',
    path: 'skills/dsh-finance-financial-statements/SKILL.md',
  },
  {
    name: 'dsh-finance-variance-analysis',
    description: 'Decompose budget, forecast, and period variances into quantified, reconciled drivers.',
    path: 'skills/dsh-finance-variance-analysis/SKILL.md',
  },
  {
    name: 'dsh-finance-close-management',
    description: 'Plan and track month-end close tasks, dependencies, blockers, deadlines, and process improvements.',
    path: 'skills/dsh-finance-close-management/SKILL.md',
  },
  {
    name: 'dsh-finance-audit-support',
    description: 'Support SOX 404 scoping, control testing, sampling, evidence, and deficiency evaluation.',
    path: 'skills/dsh-finance-audit-support/SKILL.md',
  },
  {
    name: 'dsh-finance-sox-testing',
    description: 'Build SOX control matrices, sample selections, testing workpapers, and assessment templates.',
    path: 'skills/dsh-finance-sox-testing/SKILL.md',
  },
  {
    name: 'dsh-finance-research',
    description: 'Plan source-backed public market research without inventing current financial facts.',
    path: 'skills/finance-research/SKILL.md',
  },
  {
    name: 'dsh-portfolio-risk',
    description: 'Review user-supplied portfolio exposure, concentration, cash, and risk-control flags.',
    path: 'skills/portfolio-risk/SKILL.md',
  },
] as const

export function apply(ctx: Context): void {
  for (const skill of BUNDLED_SKILLS) {
    ctx.skills.register({
      name: skill.name,
      description: skill.description,
      content: skillContent(skill.path),
      source: 'bundled',
      resourceBase: { kind: 'directory', path: PACKAGE_ROOT },
      invocation: { modelInvocable: true, userInvocable: true },
    })
  }

  ctx.tools.register(defineTool({
    name: 'finance_journal_entry_check',
    description:
      'Validate a proposed journal entry for debit-credit balance, line structure, documentation gaps, and segregation-of-duties review. ' +
      'This control check never authorizes posting.',
    parameters: {
      lines: {
        type: 'array',
        required: true,
        description: 'Journal entry lines. Use non-negative debit and credit amounts and one side per line.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            accountCode: { type: 'string' },
            accountName: { type: 'string', required: true },
            debit: { type: 'number' },
            credit: { type: 'number' },
            department: { type: 'string' },
            memo: { type: 'string' },
          },
        },
      },
      period: { type: 'string', description: 'Accounting period, such as 2026-07 or 2026-Q3.' },
      currency: { type: 'string', description: 'Currency code. Defaults to USD.' },
      tolerance: { type: 'number', description: 'Maximum allowed debit-credit difference. Defaults to 0.01.' },
      preparedBy: { type: 'string', description: 'Optional preparer identifier for segregation review.' },
      approvedBy: { type: 'string', description: 'Optional approver identifier for segregation review.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderJson(value) }],
    },
    execute: async args => toJsonRecord(checkJournalEntry(args as JournalEntryCheckArgs)),
    timeoutMs: 5000,
  }))

  ctx.tools.register(defineTool({
    name: 'finance_reconciliation_snapshot',
    description:
      'Reconcile book and source balances using signed adjustments, categorize reconciling items, calculate aging, and determine review readiness. ' +
      'This control check never authorizes sign-off.',
    parameters: {
      bookBalance: { type: 'number', required: true, description: 'Unadjusted GL or book balance.' },
      sourceBalance: { type: 'number', required: true, description: 'Unadjusted subledger, bank, or third-party balance.' },
      items: {
        type: 'array',
        description: 'Signed reconciling adjustments added to either the book or source balance.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            description: { type: 'string', required: true },
            amount: { type: 'number', required: true },
            appliesTo: { type: 'string', required: true, description: 'book or source' },
            category: {
              type: 'string',
              required: true,
              description: `One of: ${RECONCILIATION_CATEGORIES.join(', ')}.`,
            },
            originatedDate: { type: 'string', description: 'YYYY-MM-DD date used for aging.' },
            owner: { type: 'string' },
          },
        },
      },
      asOfDate: { type: 'string', description: 'YYYY-MM-DD reconciliation date.' },
      tolerance: { type: 'number', description: 'Maximum allowed adjusted difference. Defaults to 0.01.' },
      staleAfterDays: { type: 'number', description: 'Age at which an item is stale. Defaults to 90 days.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderJson(value) }],
    },
    execute: async args => toJsonRecord(reconcileAccount(args as ReconciliationArgs)),
    timeoutMs: 5000,
  }))

  ctx.tools.register(defineTool({
    name: 'finance_variance_bridge',
    description:
      'Validate that signed variance drivers bridge a base value to an actual value, calculate residuals and percentage variance, and evaluate optional materiality thresholds.',
    parameters: {
      baseValue: { type: 'number', required: true, description: 'Budget, forecast, or prior-period value.' },
      actualValue: { type: 'number', required: true, description: 'Actual or current-period value.' },
      drivers: {
        type: 'array',
        required: true,
        description: 'Signed drivers that should sum to actualValue minus baseValue.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true },
            amount: { type: 'number', required: true },
          },
        },
      },
      tolerance: { type: 'number', description: 'Maximum allowed bridge residual. Defaults to 0.01.' },
      dollarMateriality: { type: 'number', description: 'Optional absolute amount threshold.' },
      percentMateriality: { type: 'number', description: 'Optional absolute percentage threshold.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderJson(value) }],
    },
    execute: async args => toJsonRecord(analyzeVarianceBridge(args as VarianceBridgeArgs)),
    timeoutMs: 5000,
  }))

  ctx.tools.register(defineTool({
    name: 'finance_research_workflow',
    description:
      'Create a source-backed financial research workflow for a company, security, sector, or macro target. ' +
      'Use before answering finance questions that require current facts, valuation, earnings, catalysts, or risk work.',
    parameters: {
      target: {
        type: 'string',
        required: true,
        description: 'Company, ticker, security, sector, theme, or country to research.',
      },
      workflow: {
        type: 'string',
        description: `Workflow name. Supported: ${RESEARCH_WORKFLOWS.join(', ')}. Defaults to company_brief.`,
      },
      horizon: {
        type: 'string',
        description: 'Research horizon, such as "last 30 days", "next earnings", "3 years", or "2026".',
      },
      region: {
        type: 'string',
        description: 'Optional region or market, such as "US", "China", "global", or "Hong Kong".',
      },
      dataSources: {
        type: 'array',
        description: 'Optional user-provided source list to prioritize.',
        items: { type: 'string' },
      },
      requireCurrentSources: {
        type: 'boolean',
        description: 'Whether to require dated current sources for market-sensitive facts. Defaults to true.',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderJson(value) }],
    },
    execute: async args => toJsonRecord(buildResearchWorkflow(args as ResearchWorkflowArgs)),
    timeoutMs: 5000,
  }))

  ctx.tools.register(defineTool({
    name: 'portfolio_risk_snapshot',
    description:
      'Compute a portfolio exposure and concentration snapshot from user-supplied position market values. ' +
      'Use for risk-control review when the user provides positions, NAV, cash, or sector data.',
    parameters: {
      positions: {
        type: 'array',
        required: true,
        description: 'Positions with symbol, marketValue, and optional sector or assetClass.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            symbol: { type: 'string', required: true },
            marketValue: { type: 'number', required: true },
            sector: { type: 'string' },
            assetClass: { type: 'string' },
          },
        },
      },
      netLiquidation: {
        type: 'number',
        description: 'Portfolio net liquidation value or NAV. Defaults to sum(positions) + cash.',
      },
      cash: {
        type: 'number',
        description: 'Cash balance. Defaults to 0.',
      },
      maxPositionPct: {
        type: 'number',
        description: 'Position concentration limit as percent of NAV. Defaults to 20.',
      },
      maxSectorPct: {
        type: 'number',
        description: 'Sector concentration limit as percent of NAV. Defaults to 35.',
      },
      maxGrossExposurePct: {
        type: 'number',
        description: 'Gross exposure limit as percent of NAV. Defaults to 125.',
      },
      minCashPct: {
        type: 'number',
        description: 'Minimum cash as percent of NAV. Defaults to 5.',
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderJson(value) }],
    },
    execute: async args => toJsonRecord(analyzePortfolioRisk(args as PortfolioRiskArgs)),
    timeoutMs: 5000,
  }))
}
