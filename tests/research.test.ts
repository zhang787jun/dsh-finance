import { describe, expect, it } from 'vitest'
import { buildResearchWorkflow } from '../src/research.js'

describe('buildResearchWorkflow', () => {
  it('defaults to a source-backed company brief', () => {
    const plan = buildResearchWorkflow({ target: 'MSFT' })

    expect(plan.workflow).toBe('company_brief')
    expect(plan.target).toBe('MSFT')
    expect(plan.sourcePolicy.some(item => item.includes('Do not state current prices'))).toBe(true)
    expect(plan.outputSections).toContain('Sources')
  })

  it('normalizes hyphenated workflow names', () => {
    const plan = buildResearchWorkflow({ target: 'TSLA', workflow: 'valuation-snapshot' as never })

    expect(plan.workflow).toBe('valuation_snapshot')
    expect(plan.steps.some(step => step.includes('cheap, fair, or rich'))).toBe(true)
  })

  it('rejects unsupported workflows', () => {
    expect(() => buildResearchWorkflow({ target: 'AAPL', workflow: 'unsupported' as never })).toThrow('Unsupported research workflow')
  })
})
