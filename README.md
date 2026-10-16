# dsh-finance

[![CI](https://github.com/zhang787jun/dsh-finance/actions/workflows/ci.yml/badge.svg)](https://github.com/zhang787jun/dsh-finance/actions/workflows/ci.yml)
[![awesome DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![License: MIT + Apache-2.0](https://img.shields.io/badge/license-MIT%20%2B%20Apache--2.0-blue.svg)](./THIRD_PARTY_NOTICES.md)

A finance and accounting plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Version 0.2 is a capability-level DSH adaptation of Anthropic's official [`finance` plugin](https://github.com/anthropics/knowledge-work-plugins/tree/main/finance), not merely a finance-themed workflow. It ports the upstream plugin's eight skills for journal entries, reconciliation, financial statements, variance analysis, close management, SOX testing, and audit support, then adds deterministic DSH validation tools.

The source baseline is Anthropic Finance `1.3.0` at commit [`a006314`](https://github.com/anthropics/knowledge-work-plugins/commit/a006314fa00e3b7487f3b6ef7f6b4a216ae777df). This is an independent community adaptation and is not endorsed by Anthropic.

[简体中文](./README.zh-CN.md)

## Upstream parity

| Anthropic Finance skill | DSH skill | Coverage |
|---|---|---|
| `journal-entry` | `dsh-finance-journal-entry` | Accruals, depreciation, prepaids, payroll, revenue entries, support, and review |
| `journal-entry-prep` | `dsh-finance-journal-entry-prep` | Standard entry patterns, documentation, approval matrix, and error checks |
| `reconciliation` | `dsh-finance-reconciliation` | GL-to-subledger, bank, intercompany, aging, categorization, and escalation |
| `financial-statements` | `dsh-finance-financial-statements` | Income statement, balance sheet, cash flow, GAAP/IFRS presentation, and period-end adjustments |
| `variance-analysis` | `dsh-finance-variance-analysis` | Price/volume, rate/mix, headcount, spend, materiality, narratives, and waterfalls |
| `close-management` | `dsh-finance-close-management` | T+1 to T+5 close calendar, dependencies, critical path, status, and retrospectives |
| `audit-support` | `dsh-finance-audit-support` | SOX scoping, assertions, sampling, evidence, workpapers, and deficiency classification |
| `sox-testing` | `dsh-finance-sox-testing` | Control matrices, sample selection, test steps, conclusions, and remediation |

All eight skills preserve the upstream workflows and detailed reference content. Claude-specific invocation and connector assumptions were changed for DSH, and every modified file carries an adaptation notice.

## DSH tools

The plugin registers five tools:

- `finance_journal_entry_check` validates debit-credit balance, line structure, documentation gaps, and preparer/approver separation. It never authorizes posting.
- `finance_reconciliation_snapshot` calculates adjusted balances, item aging, category totals, stale-item flags, and sign-off readiness. It never authorizes sign-off.
- `finance_variance_bridge` proves that signed drivers bridge base to actual, exposes residuals, and evaluates materiality thresholds.
- `finance_research_workflow` plans source-backed public-market research.
- `portfolio_risk_snapshot` calculates exposure and concentration controls from supplied positions.

The last two are DSH extensions retained from version 0.1. They are not presented as part of Anthropic Finance parity.

## Install

Install from GitHub into a DSH profile:

```sh
dsh plugin --profile web add github:zhang787jun/dsh-finance
```

Restart DSH:

```sh
dsh web
```

For local development:

```sh
pnpm install
pnpm run check
dsh plugin --profile web add .
```

## Example requests

```text
Prepare the July AP accrual journal entry, show the support, and validate that debits equal credits.

Reconcile the cash GL to the bank statement as of 2026-07-31 and age every open item.

Build the monthly income statement, flag material variances, and reconcile the waterfall drivers.

Create a SOX testing workpaper for the revenue-recognition control for 2026-Q2.

Build a T+5 month-end close plan with owners, dependencies, blockers, and a critical path.
```

## Connectors

The skills use tool categories such as `~~erp`, `~~data warehouse`, and `~~office suite`. See [CONNECTORS.md](./CONNECTORS.md) and [connectors.example.json](./connectors.example.json).

Installation does not activate external servers or collect credentials. Without a connected source, DSH must request pasted data or local files and state the resulting evidence limitation.

## Human approval boundary

This plugin prepares and validates analyst work product. It does not post journal entries, lock accounting periods, send reports, sign off reconciliations, approve controls, or make investment decisions. Those actions remain with authorized people in the relevant system.

All outputs require review by qualified financial professionals before use in reporting, filings, audit documentation, tax work, or investment decisions.

## Development

```sh
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check
```

`pnpm run check` runs type checking, tests, build, and `npm pack --dry-run`.

## License and attribution

Original code in this repository is MIT licensed. The eight adapted finance skills are derived from Apache-2.0-licensed Anthropic material. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) and [LICENSES/Apache-2.0.txt](./LICENSES/Apache-2.0.txt).
