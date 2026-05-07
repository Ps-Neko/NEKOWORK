# Task

Build a trading dashboard mockup that demonstrates NEKOWORK's financial-risk gate.

## Scope

- Static browser UI.
- Mock portfolio chart.
- Mock watchlist.
- Disabled order ticket.
- No real broker, payment, account, or order execution wiring.

## Non-Goals

- No production trading behavior.
- No API calls.
- No authentication.
- No deploy automation.

## Recommended NEKOWORK Flow

```bash
node ../../scripts/cli.js ask "stock trading dashboard mockup with mock-only orders" --project-root . --session trading-demo
node ../../scripts/cli.js plan "stock trading dashboard mockup with mock-only orders" --project-root . --session trading-demo
node ../../scripts/cli.js team "stock trading dashboard mockup with mock-only orders" --workers planner,product,security,test --no-write --project-root . --session trading-demo
node ../../scripts/cli.js work "implement the planned trading dashboard mockup" --single-executor --project-root . --session trading-demo
node ../../scripts/cli.js verify "verify the trading dashboard mockup stays mock-only" --project-root . --session trading-demo
node ../../scripts/cli.js gate status --project-root . --session trading-demo
```
