# NEKOWORK verify-pr — Rule Benchmark

> Measured: 2026-06-10 (re-run of `npm run bench:rules`) · Slim package version: `0.2.0-alpha.11`
> Source of truth: run `npm run bench:rules -- --json` from `packages/nekowork/`.
> This page is the **single source of truth** for the rule inventory and the
> recall / false-positive numbers. Other docs (SCOPE-1.0.md, READMEs) point here.

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

The engine now ships **11 deterministic rules** (up from 5, then 8, then 10). Every
rule passes the detection gate (recall ≥ 0.95, FP ≤ 0.10) at 100% recall / 0% FP on
its current fixture corpus.

> **Publish-state caveat (read this before quoting "11 rules").** The published
> `@alpha` (`0.2.0-alpha.11`) now ships all **11 rules** measured on this page
> (`secret-fallback`, `auto-apply-commit-push`, `hardcoded-credential`,
> `test-or-security-disable`, `package-lockfile-risk`, `eval-usage`, `insecure-tls`,
> `cors-wildcard`, `sql-injection`, `command-injection`, `ast-dataflow`) and adds
> **one tiny, well-known dependency** (`acorn`, the JS parser — MIT, zero transitive
> dependencies) for the AST engine. The `latest` dist-tag is still a stale
> `0.2.0-alpha.0` (5 rules, **zero dependencies**), so always install with
> **`@alpha`**.

| Rule | Recall | FP rate | Pos caught | FP count | gate |
|---|---:|---:|---:|---:|:---:|
| `secret-fallback` | **100%** | **0%** | 65 / 65 | 0 / 21 | ✅ |
| `auto-apply-commit-push` | **100%** | **0%** | 18 / 18 | 0 / 11 | ✅ |
| `hardcoded-credential` | **100%** | **0%** | 11 / 11 | 0 / 12 | ✅ |
| `test-or-security-disable` | **100%** | **0%** | 24 / 24 | 0 / 12 | ✅ |
| `package-lockfile-risk` | **100%** | **0%** | 11 / 11 | 0 / 9 | ✅ |
| `eval-usage` | **100%** | **0%** | 17 / 17 | 0 / 7 | ✅ |
| `insecure-tls` | **100%** | **0%** | 16 / 16 | 0 / 5 | ✅ |
| `cors-wildcard` | **100%** | **0%** | 12 / 12 | 0 / 5 | ✅ |
| `sql-injection` | **100%** | **0%** | 14 / 14 | 0 / 10 | ✅ |
| `command-injection` | **100%** | **0%** | 16 / 16 | 0 / 11 | ✅ |
| `ast-dataflow` | **100%** | **0%** | 30 / 30 | 0 / 27 | ✅ |
| **Aggregate** | **100%** | **0%** | **234 / 234** | **0 / 130** | — |

`ast-dataflow` is the only **AST / dataflow** rule (all others are regex pattern
matchers): it builds an AST via `acorn` and runs **inter-procedural (intra-module)
taint analysis** to catch **variable-mediated injection** the regex rules miss — e.g.
`const q = "SELECT " + id; db.query(q)` assembled across statements, an `eval` built
from concatenated parts, a shell command stitched together before `exec`, or a sink
aliased to a local variable / fed from a local helper's return value
(`function build(x){return "SELECT "+x} db.query(build(req.id))`). It stays
**intra-module (single-file)**; cross-file and non-JS taint remain out of scope.

**Detection gate per [SCOPE §9](./SCOPE-1.0.md#9-fixture-출처-정책):** recall ≥ 0.95, FP ≤ 0.10.
The CLI prints this as "11/11 rules passing 1.0 gate."

## Fixture composition — the honest part

| Rule | Pos (syn / OSS / live AI) | Neg (syn / OSS / live AI) |
|---|---|---|
| `secret-fallback` | 33 / 30 / 2 ✅ | 18 / 3 / 0 |
| `auto-apply-commit-push` | 12 / 5 / 1 | 8 / 3 / 0 |
| `hardcoded-credential` | 11 / 0 / 0 ⚠️ syn-only | 9 / 3 / 0 |
| `test-or-security-disable` | 15 / 8 / 1 | 9 / 3 / 0 |
| `package-lockfile-risk` | 8 / 3 / 0 | 6 / 3 / 0 |
| `eval-usage` | 11 / 6 / 0 | 7 / 0 / 0 |
| `insecure-tls` | 10 / 6 / 0 | 5 / 0 / 0 |
| `cors-wildcard` | 6 / 6 / 0 | 5 / 0 / 0 |
| `sql-injection` | 8 / 6 / 0 | 7 / 3 / 0 |
| `command-injection` | 10 / 6 / 0 | 8 / 3 / 0 |
| `ast-dataflow` | 24 / 6 / 0 | 24 / 3 / 0 |
| **Total** | **148 / 82 / 4** | **106 / 24 / 0** |

Synthetic share of total positives: **63%** (148 / 234). Only `secret-fallback`
meets the §9 "30+ real OSS positives" bar (30 OSS / 33 synthetic / 2 live AI), but
there are now **~82 real OSS positives across rules** — the OSS-fixture merge added
real OSS positives to the injection rules (`eval-usage`, `insecure-tls`,
`cors-wildcard`, `sql-injection`, `command-injection`) and `ast-dataflow`, so they
are no longer synthetic-only. Only `hardcoded-credential` remains synthetic-only
(by design — see ethical note below).

### Provenance of the newer rules — read this before quoting recall

The five-rule corpus was extended to eight, then to ten, then to eleven. After the
OSS-fixture merge, most of the newer rules now carry **real OSS positives** (6 each on
`eval-usage`, `insecure-tls`, `cors-wildcard`, `sql-injection`, `command-injection`,
and `ast-dataflow`). Only one rule is still validated by **synthetic fixtures only**:

- `hardcoded-credential` — synthetic-only **by design** (see ethical note below); no
  real-OSS or live-AI positives, on purpose.

The other newer rules now have OSS evidence but **no live-AI positives yet**, so do
not present them as live-AI-validated. The provenance mix per rule:

- `secret-fallback` — the strongest: 30 real OSS positives, 2 live-AI captures.
- `auto-apply-commit-push` (5 OSS, 1 live) and `test-or-security-disable` (8 OSS, 1
  live) carry partial OSS/live evidence.
- `package-lockfile-risk` has 3 OSS positives.
- `eval-usage`, `insecure-tls`, `cors-wildcard`, `sql-injection`,
  `command-injection`, and `ast-dataflow` each carry 6 real OSS positives (0 live-AI).

There are now **~82 real OSS positives across rules** (vs. 46 before). Live-AI
coverage is still thin (4 captures across 3 rules).

### ⚠️ Ethical note on `hardcoded-credential` OSS scraping

Unlike `secret-fallback` (which detects the *shape* of a fallback), the
`hardcoded-credential` rule detects **literal credential signatures**:
`AKIA...` AWS keys, `sk_live_...` Stripe keys, `sk-...` OpenAI keys, etc.

Scraping real OSS for these patterns would harvest *actually-leaked*
credentials into our fixture corpus, even if many are already disabled
by upstream providers' secret scanners. We chose **not to do OSS positive
scraping for this rule** because storing and republishing leaked credentials
amplifies their visibility, even within a defensive-research context.

The `hardcoded-credential` positive corpus therefore remains synthetic-only.
Negative OSS coverage is OK (real OSS that mentions credentials without
hardcoding them). Long-term option: scrape + redact body (preserve shape so
regex fires) — deferred.

## What is NOT covered

Ten of the 11 rules are pattern matchers over **added diff lines** — they see a line,
not a program. The 11th rule, `ast-dataflow`, adds **inter-procedural (intra-module)**
AST/taint analysis, but it is deliberately conservative. The following are explicitly
**out of scope** — NEKOWORK routes them to a human decision rather than claiming to
catch them:

- **Logic / business-logic bugs** — wrong calculations, off-by-one, broken state
  machines. A diff can be 100% PASS and still be functionally wrong.
- **Auth / authorization flaws** — missing permission checks, broken access control,
  privilege escalation. There is no auth-bypass rule (deferred to 1.x).
- **Most injection classes** — only **basic** `sql-injection` and
  `command-injection` regex shapes plus `ast-dataflow`'s inter-procedural
  (intra-module) taint are matched. Second-order injection, ORM-mediated injection,
  template/NoSQL/LDAP/XPath injection, and anything that requires following user input
  across files are **not** detected.
- **Cross-file / whole-program dataflow** — `ast-dataflow` is **inter-procedural but
  intra-module (single-file) and JS/TS-only**. It follows taint across function
  boundaries within one file (local helper returns, sink aliases), but taint that
  crosses file boundaries, flows through whole-program dataflow, or lives in a non-JS
  language remains **regex-only or out of scope**. The regex rules see a line; the AST
  rule sees one file.
- **Non-added (context) lines** — by default verify-pr scans only **added** lines.
  Risk that already exists in unchanged code is not re-flagged unless you pass
  `--full-scan`.
- **Dependency CVEs / supply-chain reputation** — `package-lockfile-risk` flags
  *risky shapes* (postinstall hooks, git/tarball URLs), not known-vulnerable
  versions. Use `npm audit` for CVE coverage.

Treat NEKOWORK as a deterministic **risk-pattern gate**, not an exhaustive security
audit. Its value is the un-foolable, reproducible verdict on the patterns it does
cover — plus a human gate for everything else.

> **One-dependency note.** Ten rules are pure regex and need no parser. The 11th
> (`ast-dataflow`) builds an AST, so the slim package now carries **one tiny,
> well-known dependency** — `acorn`, the JS parser (MIT, **zero transitive
> dependencies**). TypeScript is parsed via Node's built-in type-stripping, so there
> is no TypeScript dependency. The leanness selling point holds: one small,
> auditable dependency rather than zero.

## What this does and doesn't prove

### What the numbers do prove

- The deterministic rule engine is **stable**: same input, same verdict, every run.
- Against the patterns the team thought to write fixtures for, the rules catch
  them with **100% aggregate recall** (234 / 234) and produce **0 false
  positives** on the negative corpus (0 / 130).
- The detection gate defined in SCOPE-1.0.md §9 is **mechanically passed** for all
  eleven rules.

### What the numbers do NOT prove

- **One rule is still synthetic-only.** `hardcoded-credential` has zero OSS and zero
  live-AI positives — by design (the ethical note above). Its recall says nothing
  about wild AI-written code.
- **`ast-dataflow` is inter-procedural but intra-module.** Its 30/30 recall measures
  single-file, JS/TS taint (now following local helpers and sink aliases) on a corpus
  that is mostly fixtures we wrote (6 OSS positives). Cross-file and whole-program
  dataflow are out of scope.
- **Supporting rules are under the OSS-positive target.** Only `secret-fallback`
  meets the §9 "30+ OSS positives" bar (30). `auto-apply-commit-push` (5),
  `test-or-security-disable` (8), `package-lockfile-risk` (3), and the six newer
  injection/AST rules (6 each) are below it.
- **Live-AI corpus is thin.** 4 live-AI positives across 3 rules vs. the §9
  target of 30+. Real coverage of how Claude Code / Cursor / Codex actually fail
  is still minimal.
- **Synthetic share is 63%** (148 / 234 positives), above the §9 ≤30% target for
  the corpus as a whole — even though the OSS-fixture merge added ~36 real OSS
  positives.

## Gap to "claim 1.0-ready"

| Requirement (SCOPE §9) | Current | Target | Status |
|---|---:|---:|:---:|
| `secret-fallback` OSS positives | **30** | 30+ | ✅ **MET** |
| `auto-apply-commit-push` OSS positives | 5 | 30+ | ⚠️ |
| `test-or-security-disable` OSS positives | 8 | 30+ | ⚠️ |
| `package-lockfile-risk` OSS positives | 3 | 30+ | ⚠️ |
| `hardcoded-credential` OSS positives | 0 (by-design) | — | 🚫 ethical scope |
| `eval-usage` / `insecure-tls` / `cors-wildcard` / `sql-injection` / `command-injection` / `ast-dataflow` OSS positives | 6 each | 30+ | ⚠️ below bar |
| Positive fixtures from live AI diffs | 4 | 30+ | ❌ |
| Overall synthetic share of positives | 63% (148/234) | ≤ 30% | ❌ |
| Recall — all 11 rules | 100% | ≥ 95% | ✅ |
| FP rate — all 11 rules | 0/130 (0%) | ≤ 10% | ✅ |
| CI benchmark job, 3 consecutive PASS | passes locally | + CI history | ⚠️ partial |

**Mechanical gate ✅, corpus honesty ⚠️.** All 11 rules pass the recall + FP gate.
The OSS-fixture merge moved the newer injection/AST rules off synthetic-only (6 real
OSS positives each), leaving only `hardcoded-credential` synthetic-only by design —
but the overall synthetic share (63%) is still well above the §9 target. Treat the
"gate ✅" markers as a **mechanical pass on an admittedly partial corpus** — not as a
claim that the rules generalize to wild AI-written code.

## How to reproduce

```bash
cd packages/nekowork
npm install
npm run bench:rules               # human-readable table
npm run bench:rules -- --json     # machine-readable, used by this page
```

You can also run the script directly:

```bash
node scripts/benchmark/rules.js            # human-readable table
node scripts/benchmark/rules.js --json     # machine-readable JSON
node scripts/benchmark/rules.js --rule secret-fallback   # one rule
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
- [ ] Grow OSS / live-AI positives for the under-target rules
      (`hardcoded-credential` stays by-design synthetic; `eval-usage`, `insecure-tls`,
      `cors-wildcard`, `sql-injection`, `command-injection`, `ast-dataflow` now have
      6 real OSS positives each but need more toward the 30+ bar)
- [ ] Generate live AI diffs by running Claude Code / Cursor / Codex on
      realistic tasks and extracting the risky-pattern diffs (4/30 captured so far)
- [ ] Rebalance the corpus so synthetic ≤ 30% of total (currently 63%)
- [ ] Add CI job that publishes the JSON to `docs/benchmark-history.jsonl` on
      every main push, so the page above stays current automatically

Until these are done, treat the "gate ✅" markers above as a **mechanical pass
on an admittedly partial corpus** (synthetic + limited OSS + minimal live-AI) — not
as a claim that the rules generalize to wild AI-written code.
