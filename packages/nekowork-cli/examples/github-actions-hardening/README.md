# GitHub Actions Hardening Project

> **Legacy session-flow example.** The `case-study/` evidence here was produced by the session orchestration (`ask -> plan -> work -> verify -> gate -> ship`, plus profiles / `auto` / `pr-prep`) — the compatibility surface in [ADVANCED.md](../../docs/ADVANCED.md), scheduled for removal in 2.0. It is not a 1.0 `verify-pr` run; for verify-pr evidence see [BENCHMARK.md](../../docs/BENCHMARK.md) and [DEMO-REPORT.md](../../docs/DEMO-REPORT.md).

This is a small standalone repository fixture used as a NEKOWORK case-study target.

It demonstrates a hardened CI workflow:

- read-only default token permissions
- explicit job permissions
- pinned action versions
- no `pull_request_target`
- no deploy or publish step
- job timeout
- no static cloud credentials

## Test

```bash
npm test
```

The test verifies the workflow hardening boundary.

## NEKOWORK Case Study

See [case-study/TASK.md](case-study/TASK.md) for the workflow evidence:

```text
ask -> plan -> team -> work -> verify -> gate -> ship
```

The important product rule is that CI/security changes are deploy-sensitive. They require Codex verification and may require Human Gate before ship readiness.
