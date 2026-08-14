import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.js'

describe('DSH plugin registration', () => {
  it('registers the complete finance skill and tool surface', () => {
    const skills: string[] = []
    const tools: string[] = []
    const context = {
      skills: {
        register: (skill: { name: string }) => skills.push(skill.name),
      },
      tools: {
        register: (tool: { name: string }) => tools.push(tool.name),
      },
    } as unknown as Context

    apply(context)

    expect(skills).toEqual(expect.arrayContaining([
      'dsh-finance-journal-entry',
      'dsh-finance-journal-entry-prep',
      'dsh-finance-reconciliation',
      'dsh-finance-financial-statements',
      'dsh-finance-variance-analysis',
      'dsh-finance-close-management',
      'dsh-finance-audit-support',
      'dsh-finance-sox-testing',
      'dsh-finance-research',
      'dsh-portfolio-risk',
    ]))
    expect(skills).toHaveLength(10)
    expect(tools).toEqual(expect.arrayContaining([
      'finance_journal_entry_check',
      'finance_reconciliation_snapshot',
      'finance_variance_bridge',
      'finance_research_workflow',
      'portfolio_risk_snapshot',
    ]))
    expect(tools).toHaveLength(5)
  })
})
