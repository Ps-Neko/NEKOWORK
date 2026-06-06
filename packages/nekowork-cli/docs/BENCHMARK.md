# NEKOWORK verify-pr — Rule Benchmark

> Measured: 2026-06-05 (re-run of `npm run bench:rules`) · Version: `0.1.0-alpha.12`
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
| `secret-fallback` | **98%** | **0%** | 43 / 44 | 0 / 14 | ✅ |
| `auto-apply-commit-push` | **100%** | **0%** | 14 / 14 | 0 / 9 | ✅ |
| `hardcoded-credential` | **100%** | **0%** | 4 / 4 | 0 / 8 | ✅ |
| `test-or-security-disable` | **100%** | **0%** | 15 / 15 | 0 / 8 | ✅ |
| `package-lockfile-risk` | **100%** | **0%** | 9 / 9 | 0 / 8 | ✅ |
| **Aggregate** | **99%** | **0%** | **85 / 86** | **0 / 47** | — |

**1.0 gate per [SCOPE §9](./SCOPE-1.0.md#9-fixture-출처-정책):** recall ≥ 0.90, FP ≤ 0.10.

The one missed positive (`sf-pos-004`) is `if (!token) token = "literal"` — a
flow-based pattern that requires multi-line scope. Documented limitation, not a
regression.

The `secret-fallback` corpus now includes **30 real OSS positive fixtures**
(promoted across scrape rounds — `JWT_SECRET`, `OPENAI_API_KEY`,
`STRIPE_SECRET_KEY`, plus the empty-string `|| ""` variant) alongside 12
synthetic and 2 live-AI positives. **The 1.0 §9 target of 30+ OSS positives is
met for this rule** (44 total positives: 30 OSS / 12 synthetic / 2 live AI).
Several OSS sources are popular repos (1051⭐, 3237⭐, 897⭐ and up). See
*OSS scrape rounds* below for the path that got us here.

## Fixture composition — the honest part

| Rule | Pos (syn / OSS / live AI) | Neg (syn / OSS / live AI) |
|---|---|---|
| `secret-fallback` | 12 / 30 / 2 ✅ | 11 / 3 / 0 |
| `auto-apply-commit-push` | 8 / 5 / 1 | 6 / 3 / 0 |
| `hardcoded-credential` | 4 / 0 / 0 ⚠️ | 5 / 3 / 0 |
| `test-or-security-disable` | 6 / 8 / 1 | 5 / 3 / 0 |
| `package-lockfile-risk` | 6 / 3 / 0 | 5 / 3 / 0 |
| **Total** | **36 / 46 / 4** | **32 / 15 / 0** |

Distinct OSS source repos: **3** (negatives — `expressjs/express`) +
**38** (positives, 4 rules covered). Synthetic share of total positives:
**42%** (36 / 86, down from 100% at session start). Star distribution of positive
OSS repos:

| Stars | Count | Notables |
|---|---:|---|
| 10000+ | 2 | cypress-io/cypress (49650⭐), mongodb/node-mongodb-native (10181⭐) |
| 1000-9999 | 9 | guaguaguaxia/weekly_report (3237⭐), deepstreamIO (7188⭐), iyaja/llama-fs (5728⭐), CaviraOSS/OpenMemory (4157⭐), flydelabs/flyde (3503⭐), mayneyao/eidos (3134⭐), unlight/tailwind-components (2025⭐), anvaka/pm (1758⭐), langwatch/better-agents (1522⭐), wesbos/dotfiles (1293⭐), tmcw/docbox (1132⭐), leoning60/browsernode (1051⭐) |
| 100-999 | 11 | PragmaticMachineLearning/probly (897⭐), julianpoy/RecipeSage (883⭐), ASDAlexander77 (706⭐), Huxpro (675⭐), coasty-ai (659⭐), …|
| 1-99 | 13 | … |
| 0 | 3 | newer / unpublished repos |

### ⚠️ Ethical note on `hardcoded-credential` OSS scraping

Unlike `secret-fallback` (which detects the *shape* of a fallback), the
`hardcoded-credential` rule detects **literal credential signatures**:
`AKIA...` AWS keys, `sk_live_...` Stripe keys, `sk-...` OpenAI keys, etc.

Scraping real OSS for these patterns would harvest *actually-leaked*
credentials into our fixture corpus, even if many are already disabled
by upstream providers' secret scanners. We chose **not to do OSS positive
scraping for this rule** because storing and republishing leaked credentials
amplifies their visibility, even within a defensive-research context.

The `hardcoded-credential` positive corpus therefore remains synthetic-only
in 1.0. Negative OSS coverage is OK (real OSS that mentions credentials
without hardcoding them). Long-term option: scrape + redact body (preserve
shape so regex fires) — deferred.

## What this does and doesn't prove

### What the numbers do prove

- The deterministic rule engine is **stable**: same input, same verdict, every run.
- Against the patterns the team thought to write fixtures for, the rules catch
  them with **99% aggregate recall** (85 / 86) and produce **0 false positives**
  on the negative corpus (0 / 47).
- The 1.0 gate threshold defined in SCOPE-1.0.md §9 is **mechanically passed**.

### What the numbers do NOT prove

- **Supporting rules are under the OSS-positive target.** Only `secret-fallback`
  meets the §9 "30+ OSS positives" bar (30). `auto-apply-commit-push` (5),
  `test-or-security-disable` (8), and `package-lockfile-risk` (3) are below it,
  and `hardcoded-credential` is synthetic-only by design (see ethical note above).
- **Live-AI corpus is thin.** 4 live-AI positives across 3 rules vs. the §9
  target of 30+. Real coverage of how Claude Code / Cursor / Codex actually fail
  is still minimal.
- **Negative OSS corpus is shallow and shared.** The same 3 distinct OSS negative
  files back all 5 rules (15 negative checks, 3 source files). §9 targets 30+
  real OSS examples sampled per-rule; we are well under that.
- **Synthetic share is still 42%** (36 / 86 positives), above the §9 ≤30% target
  for the corpus as a whole — even though `secret-fallback` alone is at 27%.

## Gap to "claim 1.0-ready"

| Requirement (SCOPE §9) | Current | Target | Status |
|---|---:|---:|:---:|
| `secret-fallback` OSS positives | **30** | 30+ | ✅ **MET** |
| `secret-fallback` synthetic share of positives | **27%** (12/44) | ≤ 30% | ✅ **MET** |
| `auto-apply-commit-push` OSS positives | 5 | 30+ | ⚠️ 17% |
| `test-or-security-disable` OSS positives | 8 | 30+ | ⚠️ 27% |
| `package-lockfile-risk` OSS positives | 3 | 30+ | ⚠️ 10% |
| `hardcoded-credential` OSS positives | 0 (by-design) | — | 🚫 ethical scope |
| Positive fixtures from live AI diffs | 4 | 30+ | ❌ 13% |
| Overall synthetic share of positives | 42% (36/86) | ≤ 30% | ⚠️ |
| Recall — secret-fallback (n=44) | 98% | ≥ 90% | ✅ |
| Recall — auto-apply-commit-push (n=14) | 100% | ≥ 90% | ✅ |
| Recall — test-or-security-disable (n=15) | 100% | ≥ 90% | ✅ |
| Recall — package-lockfile-risk (n=9) | 100% | ≥ 90% | ✅ |
| FP rate — all rules | 0/47 (0%) | ≤ 10% | ✅ |
| CI benchmark job, 3 consecutive PASS | passes locally | + CI history | ⚠️ partial |

**🎯 1.0 §9 killer-rule (`secret-fallback`) 모든 게이트 충족.** Supporting rule
3종은 OSS coverage 부족이지만 recall + FP 게이트는 통과 — 시간상 추가 scrape
로 끌어올리는 작업은 marginal returns 영역.

## Historical scrape note — First real OSS scrape (past record, superseded by current measurement above)

> **Note:** The following section records intermediate results from the first OSS scrape round. These numbers (90% → 93%) are historical and do not represent the current recall figure. See the *Current measurement* table at the top of this document for the latest numbers.

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

## First live-AI capture — self-test on this very codebase

Per `docs/LIVE-AI-CAPTURE.md` protocol, we ran the Tier 1 / Task 1 capture
("Add JWT-based auth middleware to this Express app.") against Claude Code
itself (Opus 4.7, 2026-05-27 session).

Procedure:

1. Sandbox workspace at `/tmp/nekowork-live-ai-session-001` — minimal Express
   skeleton, single commit baseline.
2. `node scripts/benchmark/capture-live-ai-diff.js start ...` records starting
   SHA + tool + model + task prompt.
3. Claude (Opus 4.7) implements the JWT middleware without further prompting.
4. `node scripts/benchmark/capture-live-ai-diff.js snapshot ...` captures the
   resulting diff into `tests/fixtures/live-ai/captures/`.
5. Run the rule on the captured `middleware/auth.js`.

**Result — the rule fired on Claude's own output.**

```
Findings: 1
{
  "line": 3,
  "severity": "critical",
  "pattern": "env-or-literal",
  "match": "process.env.JWT_SECRET || 'dev-secret-change-in-production'"
}
```

The exact line Claude (with full session context of the rules and the
SCOPE-1.0.md document) produced naturally:

```js
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
```

This is the textbook `env-or-literal` antipattern the rule was designed to
catch. The capture is now `sf-pos-live-001` in the active manifest, with full
provenance (`source: live-ai:claude-code:opus-4.7:tier1-jwt-auth-001`).

### Honest caveats on this capture

- **Primer bias.** The Claude session had already read `SCOPE-1.0.md` and the
  rule patterns in the same conversation. Despite that, the antipattern
  emerged in the natural code path. We interpret this as evidence the pattern
  is reflexive enough to survive priming, but it is not a *naive* Claude
  sample. Future captures from fresh Claude / Cursor / Codex sessions will be
  stronger evidence.
- **Small denominator.** This was the *first* capture (n=1 at the time). The
  protocol target is 30+ captures across 4 tools × 11 tasks; the corpus now
  holds **4 live-AI positives across 3 rules** — still well under the 30+ target.
  The supporting recall / FP numbers above do not require this denominator to be
  filled — they pass on synthetic + OSS evidence alone — but the §9 ship gate does.

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

- [x] Scrape 30+ real OSS positives for the killer rule (`secret-fallback` — 30 met);
      supporting rules (`auto-apply-commit-push` 5, `test-or-security-disable` 8,
      `package-lockfile-risk` 3) still pending
- [ ] Generate live AI diffs by running Claude Code / Cursor / Codex on
      realistic tasks and extracting the fallback-pattern diffs (4/30 captured so far)
- [ ] Rebalance the corpus so synthetic ≤ 30% of total (currently 42%)
- [ ] Add CI job that publishes the JSON to `docs/benchmark-history.jsonl` on
      every main push, so the page above stays current automatically

Until these are done, treat the "1.0 gate ✅" markers above as a **mechanical pass
on an admittedly partial corpus** (synthetic + limited OSS + minimal live-AI) — not
as a claim that the rules generalize to wild AI-written code.
