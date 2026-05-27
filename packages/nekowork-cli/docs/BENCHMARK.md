# NEKOWORK verify-pr — Rule Benchmark

> Measured: 2026-05-27 · Version: `0.1.0-alpha.12`
> Source of truth: run `npm run bench:rules -- --json` from `packages/nekowork-cli/`.

This page publishes the recall / false-positive numbers for every risk rule that
`verify-pr` ships with, plus an honest accounting of where the fixtures came from.

## Why this page exists

The reviewer principle in [`SCOPE-1.0.md`](./SCOPE-1.0.md#9-fixture-출처-정책)
is non-negotiable:

> **Synthetic-only 는 금지.** 본인이 짠 룰을 본인이 짠 fixture 로 측정하면
> recall 숫자가 의미 없음.

So we don't hide the corpus composition behind a single recall number. We publish
the full picture, including what is still missing for the 1.0 gate.

## Current measurement

| Rule | Recall | FP rate | Pos caught | FP count | 1.0 gate |
|---|---:|---:|---:|---:|:---:|
| `secret-fallback` | **90%** | **0%** | 9 / 10 | 0 / 13 | ✅ |
| `auto-apply-commit-push` | **100%** | **0%** | 8 / 8 | 0 / 9 | ✅ |
| `hardcoded-credential` | **100%** | **0%** | 4 / 4 | 0 / 8 | ✅ |
| `test-or-security-disable` | **100%** | **0%** | 6 / 6 | 0 / 8 | ✅ |
| `package-lockfile-risk` | **100%** | **0%** | 6 / 6 | 0 / 8 | ✅ |
| **Aggregate** | **97%** | **0%** | **33 / 34** | **0 / 46** | — |

**1.0 gate per [SCOPE §9](./SCOPE-1.0.md#9-fixture-출처-정책):** recall ≥ 0.90, FP ≤ 0.10.

The one missed positive (`sf-pos-004`) is `if (!token) token = "literal"` — a
flow-based pattern that requires multi-line scope. Documented limitation, not a
regression.

## Fixture composition — the honest part

| Rule | Pos (syn / OSS / live AI) | Neg (syn / OSS / live AI) |
|---|---|---|
| `secret-fallback` | 10 / 0 / 0 | 10 / 3 / 0 |
| `auto-apply-commit-push` | 8 / 0 / 0 | 6 / 3 / 0 |
| `hardcoded-credential` | 4 / 0 / 0 | 5 / 3 / 0 |
| `test-or-security-disable` | 6 / 0 / 0 | 5 / 3 / 0 |
| `package-lockfile-risk` | 6 / 0 / 0 | 5 / 3 / 0 |
| **Total** | **34 / 0 / 0** | **31 / 15 / 0** |

The 15 OSS negatives are the same 3 files (`expressjs/express` examples) applied
across 5 rules. Distinct OSS source files: **3**.

## What this does and doesn't prove

### What the numbers do prove

- The deterministic rule engine is **stable**: same input, same verdict, every run.
- Against the patterns the team thought to write fixtures for, the rules catch
  them with **97% recall** and produce **0 false positives** on a small set of
  real-world Express examples.
- The 1.0 gate threshold defined in SCOPE-1.0.md §9 is **mechanically passed**.

### What the numbers do NOT prove

- **0 positive fixtures from real OSS or live AI tools.** All positive fixtures
  are synthetic — written by the same author as the rules. Per SCOPE-1.0.md §9
  this is explicitly insufficient as final 1.0 evidence.
- **Negative OSS corpus is 3 files.** SCOPE-1.0.md §9 sets the target at "30+"
  real OSS examples (popular repos, ≥100 stars). We are at **10% of the target**.
- **0 live AI-generated diffs.** SCOPE-1.0.md §9 specifies that live diffs from
  Claude Code / Cursor / Codex on real tasks must be part of the corpus. Not
  collected yet.
- **Cross-rule contamination.** The same 3 OSS files act as negatives for all 5
  rules. A real OSS corpus should be sampled per-rule.

## Gap to "claim 1.0-ready"

| Requirement (SCOPE §9) | Current | Target | Status |
|---|---:|---:|:---:|
| Positive fixtures from real OSS scrape (in active manifest) | 0 | 30+ | ❌ |
| OSS positive candidates collected (pending human review) | 10 | 30+ | ⚠️ |
| Positive fixtures from live AI diffs | 0 | 30+ | ❌ |
| Synthetic share of total corpus | 79% | ≤ 30% | ❌ |
| Recall on Secret Fallback (existing synthetic) | 90% | ≥ 90% | ✅ |
| Recall on real OSS slice, in-scope patterns | 100% (6/6) | ≥ 90% | ✅ |
| Recall on real OSS slice, all candidates | 60% (6/10) | — | ⚠️ |
| FP rate on Secret Fallback (existing) | 0% | ≤ 10% | ✅ |
| CI benchmark job, 3 consecutive PASS | passes locally | + CI history | ⚠️ partial |

## First real OSS scrape — what we found

We ran `scripts/benchmark/scrape-oss-positives.js` with query
`process.env.JWT_SECRET || "` (TypeScript, n=10). Each candidate was pinned to
its repo's default-branch SHA, downloaded, and auto-scanned by the rule. Stored
under `tests/fixtures/secret-fallback/positive/candidates/` with full
provenance (`candidates.json`).

**Result: 6 caught, 4 missed.** The misses are revealing:

| Miss | Pattern | Why the rule doesn't catch it |
|---|---|---|
| candidate-2 | `process.env.JWT_SECRET \|\| ""` | Empty-string fallback. Rule regex requires 1+ chars (`[^"'\`\n]+`) by design. |
| candidate-3 | `process.env.JWT_SECRET \|\| ""` | Same. |
| candidate-7 | `process.env.JWT_SECRET \|\| ""` | Same. |
| candidate-8 | `process.env.NODE_ENV` (no fallback) | Search false-match, no `||` literal. |

**This is a major scope finding:** the most common AI-generated env-fallback
pattern in real OSS is `|| ""`, but `SCOPE-1.0.md §6` explicitly targets only
non-empty literals. Three options:

1. **Keep current scope** (status quo) — but acknowledge in docs that
   `|| ""` (silent empty-secret) is NOT caught.
2. **Expand secret-fallback to include `|| ""`** — high recall gain on real
   code, but needs FP regression test (legit defensive code uses this).
3. **New rule `empty-secret-fallback`** — separate severity (HIGH not
   CRITICAL?), separate FP measurement, clean scope boundary.

→ Open question for 1.0. Tracked in roadmap.

The 6 caught files are in the candidates directory awaiting human spot-check
(some catches are via the broad `multi-line-or-literal` pattern, which may
match unrelated literals within 240 chars — needs visual confirmation before
promotion to the active `manifest.json`).

## How to reproduce

```bash
cd packages/nekowork-cli
npm install
npm run bench:rules               # human-readable table
npm run bench:rules -- --json     # machine-readable, used by this page
npm run bench:rules -- --rule secret-fallback   # one rule
```

Exit code is non-zero iff any rule fails its `targets.recall` / `targets.fp` gate.
Used in CI to catch detection-quality regressions.

## Adding a fixture

1. Drop the file into `tests/fixtures/<rule>/positive/` or `negative/`.
2. Add an entry to `tests/fixtures/<rule>/manifest.json` with **`source`** set to
   one of `synthetic`, `github:<owner>/<repo>@<sha>:<path>`, or `live-ai`.
3. Run `npm run bench:rules` and verify the numbers move in the expected
   direction.
4. For OSS samples shared across multiple rules, prefer adding to
   `tests/fixtures/oss-negatives/manifest.json` with the right
   `applies_to_rules` list. The benchmark picks them up automatically.

## Roadmap to honest numbers

Per SCOPE-1.0.md §13.2 the ship gate combines internal benchmark + external
alpha signal. The benchmark side needs:

- [ ] Scrape 30+ real OSS positives per killer rule (`secret-fallback` first)
- [ ] Generate live AI diffs by running Claude Code / Cursor / Codex on
      realistic tasks and extracting the fallback-pattern diffs
- [ ] Rebalance the corpus so synthetic ≤ 30% of total
- [ ] Add CI job that publishes the JSON to `docs/benchmark-history.jsonl` on
      every main push, so the page above stays current automatically

Until the first three are done, treat the "1.0 gate ✅" markers above as
**mechanical pass on an admittedly synthetic corpus** — not as a claim that the
rules generalize to wild AI-written code.
