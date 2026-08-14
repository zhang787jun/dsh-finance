# Connectors

The finance skills describe external systems by category so they remain usable with different ERP, warehouse, spreadsheet, and collaboration stacks.

## Category mapping

| Skill placeholder | Connect a DSH-accessible tool for | Typical systems |
|---|---|---|
| `~~erp` | Trial balance, GL, subledgers, journal entries, and close status | NetSuite, SAP, QuickBooks, Xero |
| `~~data warehouse` | Historical finance queries and reconciled analytical data | Snowflake, Databricks, BigQuery, PostgreSQL |
| `~~office suite` | Spreadsheet workpapers, statements, and reporting packages | Microsoft 365, Google Workspace |
| `~~analytics` | KPI dashboards and variance context | Power BI, Tableau, Looker |
| `~~email` | Evidence requests, approvals, and report distribution | Outlook, Gmail |
| `~~chat` | Close coordination and blocker escalation | Slack, Microsoft Teams |

## DSH behavior

This package does not activate or authenticate external MCP servers during installation. Use [`connectors.example.json`](./connectors.example.json) as a category template, then configure only the servers approved for the target DSH profile.

If no connector is available, the skills must ask for pasted data or local files. They must not invent GL balances, account codes, approvals, sample populations, or audit evidence.

Treat data extraction and transaction posting as separate authorities. The plugin may prepare or validate workpapers, but posting a journal entry, locking a period, sending a report, or signing off a control remains a human-approved action in the connected system.
