# dsh-finance

[![CI](https://github.com/zhang787jun/dsh-finance/actions/workflows/ci.yml/badge.svg)](https://github.com/zhang787jun/dsh-finance/actions/workflows/ci.yml)
[![awesome DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![License: MIT + Apache-2.0](https://img.shields.io/badge/license-MIT%20%2B%20Apache--2.0-blue.svg)](./THIRD_PARTY_NOTICES.md)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的财务与会计插件。

`0.2` 版以 Anthropic 官方 [`finance` 插件](https://github.com/anthropics/knowledge-work-plugins/tree/main/finance)为内容基准，不再只是一个泛金融工作流。它完整迁移上游 8 个技能，覆盖日记账、对账、三大报表、差异分析、月结管理、SOX 测试和审计支持，并增加 DSH 原生的确定性校验工具。

基准版本为 Anthropic Finance `1.3.0`，固定到 commit [`a006314`](https://github.com/anthropics/knowledge-work-plugins/commit/a006314fa00e3b7487f3b6ef7f6b4a216ae777df)。本项目是独立社区适配，不代表 Anthropic 官方背书。

[English](./README.md)

## 上游能力对照

| Anthropic Finance 技能 | DSH 技能 | 覆盖内容 |
|---|---|---|
| `journal-entry` | `dsh-finance-journal-entry` | 应计、折旧、预付、薪酬、收入分录、支持材料与复核 |
| `journal-entry-prep` | `dsh-finance-journal-entry-prep` | 标准分录模式、文档要求、审批矩阵与常见错误 |
| `reconciliation` | `dsh-finance-reconciliation` | 总账对子账、银行对账、内部往来、账龄、分类与升级 |
| `financial-statements` | `dsh-finance-financial-statements` | 利润表、资产负债表、现金流量表、GAAP/IFRS 展示与期末调整 |
| `variance-analysis` | `dsh-finance-variance-analysis` | 价量、费率/结构、人数、费用、重要性、叙述与瀑布桥接 |
| `close-management` | `dsh-finance-close-management` | T+1 到 T+5 关账日历、依赖、关键路径、状态与复盘 |
| `audit-support` | `dsh-finance-audit-support` | SOX 范围、认定、抽样、证据、底稿与缺陷分级 |
| `sox-testing` | `dsh-finance-sox-testing` | 控制矩阵、样本选择、测试步骤、结论与整改 |

这 8 个技能保留了上游的完整工作流、模板、检查表和专业参考内容，只针对 DSH 修改了命名、调用方式、连接器边界和人审控制。

## DSH 工具

插件注册 5 个工具：

- `finance_journal_entry_check`：检查借贷平衡、分录行结构、文档缺口和制单/审批职责分离，不授权过账。
- `finance_reconciliation_snapshot`：计算调整后余额、账龄、分类汇总、陈旧项和签字准备状态，不授权签字。
- `finance_variance_bridge`：验证驱动因素是否从基准值完整桥接到实际值，显式暴露残差并判断重要性。
- `finance_research_workflow`：规划有来源约束的公开市场研究。
- `portfolio_risk_snapshot`：基于用户提供的持仓计算敞口和集中度控制。

后两项是 `0.1` 版保留的 DSH 扩展，不计入 Anthropic Finance 的对等迁移。

## 安装

```sh
dsh plugin --profile web add github:zhang787jun/dsh-finance
dsh web
```

本地开发：

```sh
pnpm install
pnpm run check
dsh plugin --profile web add .
```

## 示例请求

```text
准备 7 月 AP 应计分录，列出支持材料，并验证借贷相等。

按 2026-07-31 将现金总账与银行对账单核对，并给所有未清项计算账龄。

生成月度利润表，标记重大差异，并验证瀑布桥接驱动是否完全勾稽。

为 2026-Q2 收入确认控制生成 SOX 测试底稿。

建立 T+5 月结计划，包含负责人、依赖、阻塞项和关键路径。
```

## 连接器

技能使用 `~~erp`、`~~data warehouse`、`~~office suite` 等工具类别。配置边界见 [CONNECTORS.md](./CONNECTORS.md) 和 [connectors.example.json](./connectors.example.json)。

安装时不会自动启用外部服务器，也不会收集凭据。没有数据连接时，DSH 必须要求用户粘贴数据或提供本地文件，并明确证据缺口。

## 人工审批边界

插件负责准备和校验分析底稿，不负责日记账过账、锁定会计期间、发送报告、对账签字、控制审批或投资决策。这些动作仍由相应系统中的授权人员执行。

所有输出在用于财报、监管申报、审计底稿、税务或投资决策前，都必须由合格专业人员复核。

## 开发与验证

```sh
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check
```

`pnpm run check` 依次执行类型检查、测试、构建和 `npm pack --dry-run`。

## 许可与归属

仓库原创代码采用 MIT 许可；8 个迁移技能源自 Anthropic 的 Apache 2.0 许可内容。详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) 与 [LICENSES/Apache-2.0.txt](./LICENSES/Apache-2.0.txt)。
