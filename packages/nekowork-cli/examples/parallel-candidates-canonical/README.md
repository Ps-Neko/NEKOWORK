# Parallel Candidates Canonical Demo

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
