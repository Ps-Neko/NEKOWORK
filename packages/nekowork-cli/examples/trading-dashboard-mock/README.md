# Trading Dashboard Mock Project

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
