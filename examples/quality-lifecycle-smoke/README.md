# Quality Lifecycle Smoke Project

This is a small standalone repository fixture used as a NEKOWORK quality-runtime case-study target.

It demonstrates the quality profile path:

- product and quality questions before implementation
- test-first planning
- single-executor work
- Codex verification with evidence requirements
- structured acceptance coverage
- optional strict quality blocking before ship readiness

## Test

```bash
npm test
```

The test verifies that the case-study artifacts include quality checklist, evidence fields, and acceptance coverage.

## NEKOWORK Case Study

See [case-study/TASK.md](case-study/TASK.md) for the workflow evidence:

```text
ask --profile quality -> plan -> team -> work --profile quality -> verify --profile quality --strict-quality -> ship
```

The important product rule is that quality warnings start as evidence, and `--strict-quality` can convert missing evidence or acceptance coverage into a no-ship condition.
