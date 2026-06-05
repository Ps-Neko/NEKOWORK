# Trading Dashboard Mock Project

> **Legacy session-flow example.** The `case-study/` evidence here was produced by the session orchestration (`ask -> plan -> work -> verify -> gate -> ship`, plus profiles / `auto` / `pr-prep`) — the compatibility surface in [ADVANCED.md](../../docs/ADVANCED.md), scheduled for removal in 2.0. It is not a 1.0 `verify-pr` run; for verify-pr evidence see [BENCHMARK.md](../../docs/BENCHMARK.md) and [DEMO-REPORT.md](../../docs/DEMO-REPORT.md).

This is a small standalone project used as a NEKOWORK case-study target.

It is intentionally mock-only:

- no broker SDK
- no payment provider
- no real account connection
- no order execution
- no network calls

## Run

Open `index.html` in a browser, or serve the directory with any static file server.

## Test

```bash
npm test
```

The test checks that the mock project stays local and does not introduce broker, payment, or outbound API wiring.

## NEKOWORK Case Study

See [case-study/TASK.md](case-study/TASK.md) for the workflow evidence:

```text
ask -> plan -> team -> work -> verify -> gate -> ship
```

The important product rule is that financial UI work is still gate-sensitive even when all data is mocked.
