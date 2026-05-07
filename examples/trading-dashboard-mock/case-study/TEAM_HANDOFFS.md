# Team Handoffs

## Planner

Decided: Keep the project static and self-contained.

Rejected: Real order placement, authentication, accounts, broker APIs, and deployment.

Risks: Users may mistake the mock for a live trading surface without visible copy.

Files: `index.html`, `src/styles.css`, `src/app.js`, `fixtures/market.json`, `scripts/check.mjs`

Remaining: Verify disabled controls and no outbound wiring.

## Product

Decided: Show the dashboard as an operational mock, not a marketing page.

Rejected: Hero layout, onboarding copy, or real portfolio import.

Risks: Financial UI needs clear demo-only language.

Files: `index.html`, `src/styles.css`

Remaining: Keep the warning visible above the dashboard.

## Security

Decided: No network calls, no secrets, no account tokens, no payment provider, no broker SDK.

Rejected: Any API key, OAuth, webhook, or order endpoint.

Risks: Future edits could add a broker SDK; local test should catch common tokens.

Files: `scripts/check.mjs`

Remaining: Human Gate stays required for financial context.

## Test

Decided: Use a zero-dependency Node check.

Rejected: Browser automation for this small static case study.

Risks: Static regex checks are not a substitute for full product security review.

Files: `scripts/check.mjs`, `fixtures/market.json`

Remaining: Run `npm test`.
