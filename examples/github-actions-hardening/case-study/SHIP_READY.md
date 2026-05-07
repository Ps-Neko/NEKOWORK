# Ship Ready

This case study is ship-ready only after Human Gate approval.

## Required Evidence

- Work handoff exists.
- Codex verification exists.
- Risk policy was evaluated.
- Human Gate was approved.
- `npm test` passed inside this fixture.

## Ship Command

```bash
node ../../scripts/cli.js ship "prepare GitHub Actions hardening ship readiness" --project-root . --session actions-hardening --require-clean-gates
```

## Apply Policy

This fixture is already present in the repository. In a live-work session, `apply` would remain explicit and would require `SHIP_READY`.
