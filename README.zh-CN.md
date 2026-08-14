# dsh-finance

[![CI](https://github.com/zhang787jun/dsh-finance/actions/workflows/ci.yml/badge.svg)](https://github.com/zhang787jun/dsh-finance/actions/workflows/ci.yml)
[![awesome DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的金融研究与组合风控工作流插件。

这个插件参考 Claude 金融研究插件的组织方式，尤其是 Bigdata.com Claude 插件的
`manifest + skills + MCP/tool` 分层，但实现为 DSH 原生 bundle：

- `package.json` 声明 `dsh.bundle.patch`
- `cordis.patch.yml` 注入 DSH profile layer
- 内置金融研究与组合风控 skills
- 通过 `@deepseek-ai/dsh-tools` 注册 DSH tools

它不自带实时行情、券商或财务数据库。插件的目标是让 agent 在做金融研究时先规划、
引用、标注时间戳和边界，避免把过期或无来源的数据说成当前事实。

## 工具

- `finance_research_workflow`：生成有来源约束的研究工作流，覆盖公司简报、投资 memo、
  估值快照、风险评估、财报质量、催化剂跟踪、行业地图、宏观/国家分析。
- `portfolio_risk_snapshot`：基于用户提供的持仓市值、NAV、现金和行业数据，计算总敞口、
  净敞口、现金比例、集中度和控制线触发项。

## 内置 Skills

- `dsh-finance-research`：把金融问题路由到合适研究工作流，并强制当前来源纪律。
- `dsh-portfolio-risk`：审查用户提供的组合数据，输出敞口、集中度、现金和风险控制项。

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

## 安全边界

金融数据变化很快。凡是价格、市值、估值倍数、盈利预期、持仓、评级、宏观数据等
市场敏感事实，都必须来自当前会话里的有日期来源。

本插件仅用于研究辅助，不构成投资、法律、税务或会计建议，也不是买入、卖出或持有
任何证券的推荐。

## 社区

仓库会添加 `dsh-plugin` GitHub topic，方便 DSH 插件搜索工具和社区索引发现。

## License

[MIT](./LICENSE)
