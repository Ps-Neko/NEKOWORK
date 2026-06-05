# PR Prep Smoke

> **Legacy session-flow example.** The `case-study/` evidence here was produced by the session orchestration (`ask -> plan -> work -> verify -> gate -> ship`, plus profiles / `auto` / `pr-prep`) — the compatibility surface in [ADVANCED.md](../../docs/ADVANCED.md), scheduled for removal in 2.0. It is not a 1.0 `verify-pr` run; for verify-pr evidence see [BENCHMARK.md](../../docs/BENCHMARK.md) and [DEMO-REPORT.md](../../docs/DEMO-REPORT.md).

This fixture demonstrates the `0.1.0-alpha.10` PR Prep path.

It represents a verified parser change where NEKOWORK has already produced ship-ready evidence, then `pr-prep` turns that session into review-ready local artifacts:

- `PR_SUMMARY.md`
- `RISK_NOTES.md`
- `TEST_EVIDENCE.md`
- `CHANGELOG_DRAFT.md`
- `SHIP_DECISION.md`
- `REPORT.md`

No branch, commit, push, pull request, apply, publish, or deploy action is performed.

Run the fixture check:

```bash
npm test
```
