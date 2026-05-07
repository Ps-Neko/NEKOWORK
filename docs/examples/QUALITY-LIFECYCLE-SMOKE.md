# Quality Lifecycle Smoke

`examples/quality-lifecycle-smoke` is a small case-study target for the NEKOWORK quality profile.

It demonstrates this path:

```text
ask --profile quality
  -> plan
  -> team
  -> work --profile quality
  -> verify --profile quality --strict-quality
  -> ship
```

The example is intentionally small. Its purpose is to show the quality-runtime evidence shape:

- `ask` records quality questions and the quality checklist.
- `work` remains single-executor.
- `verify` requires evidence-based findings for high/critical issues.
- `verify-summary.json` can carry structured `acceptance_coverage`.
- `--strict-quality` can convert unresolved quality warnings into a fix-required verification verdict.
- `ship` remains readiness only; `apply` is still explicit.

Run the local check:

```bash
cd examples/quality-lifecycle-smoke
npm test
```

This example is not a substitute for a named third-party external project case study. It is a checked-in fixture that proves the quality lifecycle contract is inspectable.
