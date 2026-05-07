# Risk Classifier

NEKOWORK classifies task and file risk before verification and ship readiness. The shared implementation lives in:

```text
scripts/lib/risk-classifier.js
```

## Outputs

The classifier returns:

- `risk`: `low`, `medium`, `high`, or `critical`
- `tags`: detected risk categories
- `requiresCodexChallenge`: whether Codex challenge should run
- `requiresHumanGate`: whether a human decision is required
- `sensitive`: whether the work is sensitive for challenge/gate purposes

## Gate-Sensitive Tags

| Tag | Examples | Policy |
|---|---|---|
| `security` | auth, OAuth, JWT, token, secret, TLS, CSRF, CORS, XSS, webhook | Codex challenge |
| `financial` | trading, broker, orders, payment, billing, refunds | Codex challenge + Human Gate |
| `deploy` | production, release, CI/CD, workflows, cloud, infrastructure | Codex challenge + Human Gate |
| `data` | database migration, delete, truncate, PII, rollback-sensitive work | Codex challenge |
| `product-ui` | UI, UX, frontend, dashboard, mockup, prototype | scope questions |

Critical verification findings always require Human Gate.

## Current Enforcement

- `ask` uses the classifier to shape questions and draft success criteria.
- `dispatch` records classifier risk in routing traces.
- `verify` uses it to decide Codex challenge and risk-policy Human Gate.
- `ship` rechecks risk policy so seeded or manually edited sessions cannot bypass a gate.

## Human Gate Reasons

Verification handoffs trigger gate reasons when:

- a Codex handoff returns `verdict: block`
- any issue has `severity: critical`
- task/file policy requires a human gate, such as financial or deploy-sensitive work

The gate marker is written as:

```text
.harness/state/sessions/<id>/HUMAN_GATE
```
