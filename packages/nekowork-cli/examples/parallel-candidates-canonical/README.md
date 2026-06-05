# Parallel Candidates Canonical Demo

> **Legacy session-flow example.** The `case-study/` evidence here was produced by the session orchestration (`ask -> plan -> work -> verify -> gate -> ship`, plus profiles / `auto` / `pr-prep`) — the compatibility surface in [ADVANCED.md](../../docs/ADVANCED.md), scheduled for removal in 2.0. It is not a 1.0 `verify-pr` run; for verify-pr evidence see [BENCHMARK.md](../../docs/BENCHMARK.md) and [DEMO-REPORT.md](../../docs/DEMO-REPORT.md).

This fixture demonstrates the alpha.9 parallel-candidate path:

- multiple isolated candidate patches are captured as evidence
- each candidate is verified before arbitration
- the arbiter selects one canonical candidate
- the selected candidate receives final Codex verification
- clean final verification promotes canonical handoffs and ship readiness
- final apply remains explicit

## Test

```bash
npm test
```

The local test checks the tiny parser fixture and verifies that the case-study artifacts record candidate verification, arbiter selection, canonical promotion, and explicit apply control.

## NEKOWORK Case Study

See [case-study/TASK.md](case-study/TASK.md) for the workflow evidence.

```text
auto --parallel-candidates 2
  -> candidate verification
  -> arbiter selection
  -> final Codex verification
  -> canonical handoff promotion
  -> ship readiness
  -> explicit apply only
```
