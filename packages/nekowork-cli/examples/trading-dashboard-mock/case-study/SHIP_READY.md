# Ship Ready

This case study is ship-ready only after Human Gate approval.

## Required Evidence

- Work handoff exists.
- Codex verification exists.
- Risk policy was evaluated.
- Human Gate was approved.
- `npm test` passed inside this mock project.

## Ship Command

```bash
node ../../scripts/cli.js ship "prepare trading dashboard mock ship readiness" --project-root . --session trading-demo --require-clean-gates
```

## Apply Policy

This static example is already present in the repository. In a live-work session, `apply` would remain explicit and would require `SHIP_READY`.
