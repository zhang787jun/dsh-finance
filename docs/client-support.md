# Client discussion and support

Use this public repository for installation questions, software problems using anonymized inputs, documentation feedback and feature requests. Issues provide the discussion history; pull requests provide reviewable code and documentation changes. New public research showcases are not a separate product goal.

Include the plugin version, command or tool used, expected result, actual result and a small sanitized example. Customer workpapers, private financial records and credentials stay in the private workspace agreed with the client. Do not put them into public issues or attachments.

The distributed plugin is self-contained and does not require private research repositories, private strategy packages or personal policy configuration. Customer-specific integrations belong in their authorized private workspace; only generally reusable, sanitized improvements return here.

## Portfolio metric conventions

`portfolio_risk_snapshot` uses signed market values for net exposure and absolute lot market values for gross exposure. A supplied NAV is used directly; otherwise NAV is net position value plus separately supplied cash. Position concentration aggregates duplicate symbols using gross lot exposure. Sector concentration likewise uses absolute exposure.

All supplied amounts must use a consistent base currency and valuation time; the tool does not perform FX conversion. Do not compare gross exposure with another system's positive-long-risk-only exposure without reconciling the definition. Default thresholds are tool configuration, not any client's or maintainer's private investment policy. A snapshot result does not authorize a trade or override human review.

Existing licenses and attribution remain in force. Repository organization changes do not alter runtime behavior or the installation path.
