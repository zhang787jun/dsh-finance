# dsh-finance

[![CI](https://github.com/zhang787jun/dsh-finance/actions/workflows/ci.yml/badge.svg)](https://github.com/zhang787jun/dsh-finance/actions/workflows/ci.yml)
[![awesome DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Financial research and portfolio risk workflow tools for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This plugin adapts the structure of Claude financial research plugins, especially the
skill-heavy Bigdata.com Claude plugin pattern, into a native DSH bundle:

- a DSH `dsh.bundle.patch` entry in `package.json`
- a `cordis.patch.yml` layer
- bundled finance skills
- DSH tools registered through `@deepseek-ai/dsh-tools`

It does not ship a market-data provider. The tools are designed to make the agent plan,
cite, and bound financial work without inventing current prices, estimates, filings, or
brokerage facts.

[简体中文](./README.zh-CN.md)

## Tools

- `finance_research_workflow` creates a source-backed workflow for:
  - company briefs
  - investment memos
  - valuation snapshots
  - risk assessments
  - earnings quality checks
  - catalyst monitors
  - sector maps
  - macro or country reviews
- `portfolio_risk_snapshot` computes exposure and control flags from user-supplied
  positions, NAV, cash, and optional sector data.

## Bundled Skills

- `dsh-finance-research` routes finance requests into the right workflow and enforces
  current-source discipline.
- `dsh-portfolio-risk` reviews user-provided portfolio data for gross/net exposure,
  concentration, cash, and control breaches.

## Install

Install from GitHub into the DSH web profile:

```sh
dsh plugin --profile web add github:zhang787jun/dsh-finance
```

Restart DSH:

```sh
dsh web
```

For local development from this checkout:

```sh
pnpm install
pnpm run check
dsh plugin --profile web add .
```

## Example

Ask DSH:

```text
Build a valuation snapshot workflow for MSFT. Use current sources only.
```

Or provide portfolio inputs:

```json
{
  "netLiquidation": 100000,
  "cash": 4000,
  "positions": [
    { "symbol": "MSFT", "marketValue": 30000, "sector": "Technology" },
    { "symbol": "GOOGL", "marketValue": 25000, "sector": "Communication Services" },
    { "symbol": "SMH", "marketValue": 20000, "sector": "Technology" }
  ]
}
```

The plugin will calculate control flags, but the data itself must come from
the user, a broker snapshot, or a cited source.

## Safety Model

Financial and market data changes quickly. This plugin deliberately requires
dated sources for market-sensitive claims and carries unavailable data as an
explicit limitation.

It is for research assistance only. It is not investment, legal, tax, or
accounting advice and is not a recommendation to buy, sell, or hold any
security.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check
```

`pnpm run check` runs typecheck, tests, build, and `npm pack --dry-run`.

## Community

This repo uses the `dsh-plugin` GitHub topic so it can be discovered by DSH
plugin search tools and the broader DSH plugin community.

## License

[MIT](./LICENSE)
