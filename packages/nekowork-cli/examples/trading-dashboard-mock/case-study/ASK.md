# Ask

Expected question-gate outcome:

```text
risk=high
tags=financial,product-ui
requiresCodexChallenge=true
requiresHumanGate=true
```

## Blocking Questions

1. Must all order behavior stay disabled and mock-only?
2. Are broker, account, payment, and order APIs explicitly out of scope?
3. What visual states are required for the dashboard?
4. What evidence proves the mock cannot place real trades?

## Draft Success Criteria

1. The dashboard renders portfolio, watchlist, and order-ticket surfaces.
2. Order controls are disabled.
3. No outbound network, broker SDK, payment SDK, or account integration exists.
4. A local test verifies the mock-only boundary.
