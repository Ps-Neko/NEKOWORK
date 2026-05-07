# Trading Dashboard Mock Example

This example shows how NEKOWORK handles a financial UI request without treating it like a normal low-risk mockup.

The checked-in standalone target project lives at:

```text
examples/trading-dashboard-mock/
```

It includes a static dashboard, local fixture data, a zero-dependency mock-boundary test, and case-study artifacts under `case-study/`.

## Request

```text
Build a trading dashboard mockup. It must use mock data only and must not place real orders.
```

## Recommended Flow

```bash
node scripts/cli.js ask "stock trading dashboard mockup with mock-only orders" --session trading-demo
node scripts/cli.js plan "stock trading dashboard mockup with mock-only orders" --session trading-demo
node scripts/cli.js team "stock trading dashboard mockup with mock-only orders" --workers planner,product,security,test --no-write --session trading-demo
node scripts/cli.js work "implement the planned trading dashboard mockup" --single-executor --session trading-demo
node scripts/cli.js verify "verify the trading dashboard mockup stays mock-only" --session trading-demo
node scripts/cli.js gate status --session trading-demo
```

## Expected Policy Behavior

The task should classify as:

```text
risk=high
tags=financial,product-ui
requiresCodexChallenge=true
requiresHumanGate=true
```

That means:

- `ask` asks whether all broker/order/payment behavior must stay mock-only.
- `team` remains read-only.
- `work` uses one executor and records acceptance criteria.
- `verify` runs Codex review and Codex challenge.
- `verify` writes `HUMAN_GATE` even if Codex approves, because financial automation needs human confirmation.
- `ship` stays blocked until the human explicitly approves or blocks.

## Example Gate Resolution

Approve only after confirming that no real broker, payment, order, or account code is present:

```bash
node scripts/cli.js gate approve --session trading-demo --reason "Confirmed mock-only data and no real order execution."
node scripts/cli.js ship "prepare trading dashboard mock ship readiness" --require-clean-gates --session trading-demo
```

If any real-money behavior is present:

```bash
node scripts/cli.js gate block --session trading-demo --reason "Real order/payment behavior is not allowed in this mock cycle."
```

`apply` remains separate and should only run after `SHIP_READY` exists for a live-work diff.
