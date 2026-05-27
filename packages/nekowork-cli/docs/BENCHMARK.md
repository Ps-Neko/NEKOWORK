# NEKOWORK verify-pr — Rule Benchmark

> Measured: 2026-05-27 (updated post empty-string-fallback patch) · Version: `0.1.0-alpha.12`
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
| `secret-fallback` | **96%** | **0%** | 26 / 27 | 0 / 14 | ✅ |
| `auto-apply-commit-push` | **100%** | **0%** | 8 / 8 | 0 / 9 | ✅ |
| `hardcoded-credential` | **100%** | **0%** | 4 / 4 | 0 / 8 | ✅ |
| `test-or-security-disable` | **100%** | **0%** | 6 / 6 | 0 / 8 | ✅ |
| `package-lockfile-risk` | **100%** | **0%** | 6 / 6 | 0 / 8 | ✅ |
| **Aggregate** | **98%** | **0%** | **50 / 51** | **0 / 47** | — |

**1.0 gate per [SCOPE §9](./SCOPE-1.0.md#9-fixture-출처-정책):** recall ≥ 0.90, FP ≤ 0.10.

The one missed positive (`sf-pos-004`) is `if (!token) token = "literal"` — a
flow-based pattern that requires multi-line scope. Documented limitation, not a
regression.

The `secret-fallback` corpus now includes **15 real OSS positive fixtures**
(promoted from two scrape rounds — first on `JWT_SECRET`, then on
`OPENAI_API_KEY`) plus 2 new synthetic positives exercising the empty-string
variant. Three of the OSS positives come from popular repos (1051⭐, 3237⭐,
897⭐). See *First real OSS scrape* below for the path that got us here.

## Fixture composition — the honest part

| Rule | Pos (syn / OSS / live AI) | Neg (syn / OSS / live AI) |
|---|---|---|
| `secret-fallback` | 12 / 15 / 0 | 11 / 3 / 0 |
| `auto-apply-commit-push` | 8 / 0 / 0 | 6 / 3 / 0 |
| `hardcoded-credential` | 4 / 0 / 0 | 5 / 3 / 0 |
| `test-or-security-disable` | 6 / 0 / 0 | 5 / 3 / 0 |
| `package-lockfile-risk` | 6 / 0 / 0 | 5 / 3 / 0 |
| **Total** | **36 / 15 / 0** | **32 / 15 / 0** |

Distinct OSS source repos: **3** (negatives — `expressjs/express`) +
**15** (positives — diverse, all promoted into `secret-fallback`).
Star distribution of positive OSS repos: 0⭐(7), 1-99⭐(5), 100-999⭐(2),
1000+⭐(2). Latest run brought in `guaguaguaxia/weekly_report` (3237⭐) and
`leoning60/browsernode` (1051⭐).

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
| Positive fixtures from real OSS scrape (in active manifest) | 15 | 30+ | ⚠️ 50% |
| OSS positive candidates collected (pending review) | 20+ | 30+ | ⚠️ |
| Positive fixtures from live AI diffs | 0 | 30+ | ❌ |
| Synthetic share of positive corpus | 71% (36/51) | ≤ 30% | ❌ |
| Synthetic share of `secret-fallback` positives | 44% (12/27) | ≤ 30% | ⚠️ |
| Recall on Secret Fallback (synthetic+OSS, n=27) | 96% (26/27) | ≥ 90% | ✅ |
| Recall on second OSS scrape slice (OPENAI_API_KEY) | 90% (9/10) | ≥ 90% | ✅ |
| FP rate on Secret Fallback (n=14) | 0% | ≤ 10% | ✅ |
| FP rate on NODE_ENV/PORT empty-fallback guard | 0/3 | 0/N | ✅ |
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

**This was a major scope finding:** the most common AI-generated env-fallback
pattern in real OSS is `|| ""`, but the original `SCOPE-1.0.md §6` rule scope
explicitly targeted only non-empty literals (regex `[^"'\`\n]+` requires ≥1
char). Decision taken on 2026-05-27: **option 2 — extend `secret-fallback`
with a new `env-or-empty-string` pattern, scoped to secret-keyword env names
only.**

Why this choice over the other two options:

- Option 1 (keep current scope): leaves the most common real-world pattern
  uncaught. Unacceptable for a "killer rule".
- Option 2 (extend, with regex-level scope guard) ✅: same rule envelope, one
  new pattern, env name must contain a secret keyword
  (`KEY/TOKEN/SECRET/PASS(WORD)/AUTH/JWT/API/CREDENTIAL` or known provider
  prefix). FP guard test added (`sf-neg-011`) confirming `NODE_ENV || ""` etc.
  do not fire.
- Option 3 (new rule `empty-secret-fallback`): cleaner separation but worse
  UX. Users get two findings on the same diff for what is conceptually one
  problem. Deferred.

**Result after the patch:**

- OSS slice recall: 60% → **100%** (10/10 caught)
- Active `secret-fallback` recall: 90% → **93%** (synthetic+OSS, n=15)
- FP rate unchanged at 0% (new negative `sf-neg-011` exercises the
  NODE_ENV/PORT/LOG_LEVEL FP guard)

The 4 candidates previously flagged as misses turned out to be:

| Old miss | Actual content | Status after patch |
|---|---|---|
| candidate-2 | `EMAIL_PASS \|\| "" + JWT_SECRET \|\| ""` | caught (3 findings) — promoted as `sf-pos-oss-001` |
| candidate-3 | `JWT_SECRET \|\| ""` | caught — promoted as `sf-pos-oss-002` |
| candidate-7 | `JWT_SECRET \|\| ""` + `INVOICE_SECRET \|\| ""` | caught — promoted as `sf-pos-oss-003` |
| candidate-8 | `JWT_SECRET \|\| ""` + `GOOGLE_CLIENT_SECRET \|\| ""` (snippet preview was misleading; file actually has empties) | caught (2 findings) — pending promotion |

Candidates 1, 4, 5, 6, 9, 10 (originally "caught" via the broad
`multi-line-or-literal` pattern) still need visual confirmation that the
match was on the intended fallback line, not on an unrelated literal within
the 240-char window. Pending human spot-check before promotion.

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
