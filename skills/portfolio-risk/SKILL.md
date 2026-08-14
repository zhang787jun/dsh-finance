---
name: dsh-portfolio-risk
description: >
  Review user-supplied portfolio exposures, concentration, cash, gross/net exposure, and risk
  control flags. Use when the user provides holdings, NAV, cash, broker snapshots, or portfolio
  limits and wants a practical risk-control read.
---

# DSH Portfolio Risk

Use this skill for exposure and control review. It does not fetch brokerage data on its own.

## Rules

1. Ask for or locate current positions, market values, cash, and NAV before calculating exposure.
2. Treat user-provided or local broker snapshots as the source of truth, and name their timestamp.
3. Call `portfolio_risk_snapshot` once the numeric inputs are available.
4. Reconcile confusing broker fields against the position list before treating them as true exposure or leverage.
5. Distinguish calculated exposure from investment advice.

## Inputs

Each position should include `symbol`, signed `marketValue`, and optionally `sector` and `assetClass`.

Use negative `marketValue` for shorts. Gross exposure is the sum of absolute market values. Net exposure is the signed sum.

## Output

Lead with the breached controls, then summarize gross exposure, net exposure, cash, largest position, largest sector, and the next verification step. If source data is incomplete, say which field prevents a reliable risk conclusion.
