/** Financial research and portfolio-risk workflow tools for DeepSeek Harness. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-skill'
import { defineTool } from '@deepseek-ai/dsh-tools'
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

export function apply(ctx: Context): void {
  ctx.skills.register({
    name: 'dsh-finance-research',
    description: 'Plan source-backed public market research without inventing current financial facts.',
    content: skillContent('skills/finance-research/SKILL.md'),
    source: 'bundled',
    resourceBase: { kind: 'directory', path: PACKAGE_ROOT },
    invocation: { modelInvocable: true, userInvocable: true },
  })

  ctx.skills.register({
    name: 'dsh-portfolio-risk',
    description: 'Review user-supplied portfolio exposure, concentration, cash, and risk-control flags.',
    content: skillContent('skills/portfolio-risk/SKILL.md'),
    source: 'bundled',
    resourceBase: { kind: 'directory', path: PACKAGE_ROOT },
    invocation: { modelInvocable: true, userInvocable: true },
  })

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
