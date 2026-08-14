---
name: dsh-finance-research
description: >
  Plan and write source-backed financial research for companies, securities, sectors, and macro
  topics. Use when the user asks for investment memos, valuation snapshots, risk reviews,
  earnings quality, catalysts, sector maps, or public market briefs.
---

# DSH Finance Research

Use this skill for public-market research where stale or unsourced facts can mislead the user.

## Rules

1. Start by calling `finance_research_workflow` with the target and the narrowest matching workflow.
2. Resolve the entity, security, region, period, and currency before analyzing.
3. Use current, dated sources for prices, estimates, filings, transcripts, ownership, ratings, macro data, and other market-sensitive claims.
4. Separate facts, analysis, inference, and recommendation boundaries.
5. Carry unavailable data as an explicit gap. Do not fill missing financial facts from model memory.
6. End user-facing outputs with the informational-use disclaimer returned by the tool.

## Workflow Routing

Use `company_brief` for recent material developments.
Use `investment_memo` for a full thesis with variant perception, valuation, scenarios, risks, catalysts, and a recommendation boundary.
Use `valuation_snapshot` for a short cheap/fair/rich valuation read.
Use `risk_assessment` for likelihood-impact risk work.
Use `earnings_quality` for cash conversion, accruals, and accounting quality.
Use `catalyst_monitor` for a forward dated event calendar.
Use `sector_map` for industry structure and investable-universe mapping.
Use `macro_country` for country or macro transmission work.

## Quality Bar

The output is not ready until it names what matters most, what evidence supports it, what could change the view, and which facts are stale, missing, or uncertain.
