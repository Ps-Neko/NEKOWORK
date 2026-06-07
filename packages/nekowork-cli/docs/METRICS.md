# NEKOWORK North-Star Metrics

> Last updated: 2026-06-07

## Why "composite 9/10 on the adversarial review" is the wrong goal

The 7-dimension adversarial review (scored per `RUBRIC.md`) tests NEKOWORK against
a comprehensiveness-weighted rubric borrowed from general static-analysis tooling.
That rubric rewards multi-language whole-program dataflow, CVE-database lookups,
and probabilistic LLM judgments. NEKOWORK deliberately does none of those things.

Its scope is bounded by design. `BENCHMARK.md` ("What is NOT covered") is explicit:
cross-file taint, logic bugs, auth flaws, second-order injection, and CVE coverage
are out of scope — not oversights, but load-bearing constraints that keep the product
local, fast, dependency-light (one: `acorn`, MIT, zero transitive), and un-foolable.
Chasing a comprehensiveness score would require becoming Semgrep or an LLM judge.
Either path destroys the identity.

The structural ceiling for this product class on that rubric is honestly ~8.0-8.3.
Grinding past it is a category error, not a roadmap.

The right goal is adoption and real-world correctness.

---

## North-Star Metrics (4)

### 1. External weekly active users of `verify-pr`

**Definition.** Unique users — other than the author — who run `nekowork verify-pr`
on a real (non-synthetic, non-demo) diff at least once per week. Counted by
distinct npm install cohorts + self-reported usage; not instrumented.

**Why it matters.** The product currently has approximately n=1 (박준우/Reins).
Everything else is a proxy. If real people are not running it on real diffs weekly,
the rest of the metrics are measuring a product no one uses.

**Target.** 5 external WAUs within 8 weeks of the next public push.

**How to measure.** Manual cohort tracking: Show HN / alpha-tester thread replies,
GitHub issue reports, direct messages. Ask each new user to confirm "ran on a real
diff this week" once per week in a shared thread. Not automated. That is fine at n=5.

---

### 2. Wild true-positive rate

**Definition.** Of the `BLOCK` / `NEEDS_HUMAN_REVIEW` verdicts that external users
receive on real diffs, the fraction they confirm as genuinely worth flagging — i.e.,
they looked at it and agreed it was a real risk, not noise.

This is in-the-wild precision, not synthetic-fixture recall. The fixture corpus
(226/226, 100% recall, 0% FP) measures the engine on patterns we wrote fixtures for.
The wild TP rate measures whether those verdicts land on real AI-written code.

**Why it matters.** A tool with high synthetic recall but low wild precision trains
users to ignore it. One noisy false alarm per day is enough to make `verify-pr`
feel like a linter nobody asked for. The moat is un-foolable verdicts, not volume.

**Target.** >= 70% of wild BLOCK / NEEDS_HUMAN_REVIEW verdicts confirmed useful by
the user who received them.

**How to measure.** After each external user hits a non-PASS verdict, ask within 24
hours: "Was this flag worth seeing? (yes / no / unsure)." Track raw counts.
Minimum sample: 10 verdicts before reporting the rate.

---

### 3. Time-to-first-verdict

**Definition.** Elapsed wall-clock time from `npx -y @ps-neko/nekowork@alpha check`
to a real verdict output, for a brand-new user on a fresh machine with no prior
install — including npm download time.

**Why it matters.** The product's adoption loop lives or dies in the first 60 seconds.
If a new user has to wait, configure, or debug before seeing any output, they close
the terminal. A fast, honest first impression is the only viable growth path for a
solo-founder CLI product with no sales motion.

**Target.** < 60 seconds end-to-end on a typical broadband connection.

**How to measure.** Time `npx -y @ps-neko/nekowork@alpha check` on a clean machine
(or a fresh Docker container with Node pre-installed but no nekowork cache).
Run this manually before each alpha publish. Fail the publish if it regresses past
90 seconds.

---

### 4. bench:rules recall / FP (quality floor, not north star)

**Definition.** The existing deterministic detection gate: recall >= 0.95 and FP <=
0.10 per rule on the `bench:rules` fixture corpus. Currently: 11/11 rules passing
at 100% recall / 0% FP (226/226 positives caught, 0/126 false positives).
See `BENCHMARK.md` for the full table and corpus composition caveats.

**Why it matters.** This is the floor, not the ceiling. If a code change causes
recall to drop or FP to spike, the engine has regressed. CI blocks on this.

**Target.** Maintain 100% recall / 0% FP on the existing corpus. Do not ship a
rule that cannot pass its gate. Do not let the gate slip to chase coverage.

**How to measure.** `npm run bench:rules` in `packages/nekowork/`. Exit code is
non-zero on gate failure. This already runs in CI.

---

## Health check, not north star

The 7-dimension adversarial review (scored per `RUBRIC.md`) runs **quarterly** as a
structured sanity check — not as an iteration target.

**Realistic ceiling for this product class: ~8.0-8.3.**

A score in that range on a comprehensiveness-weighted rubric is honest for a tool
that is deliberately scoped to deterministic pattern matching over added diff lines
plus single-file intra-module taint. Dimensions that drag the score below 9 (cross-
file dataflow, multi-language SAST breadth, CVE lookup) are not gaps to close — they
are features this product chose not to have.

Use the quarterly review to catch genuine regressions in the dimensions that do apply:
verdict stability, FP discipline, documentation accuracy, install experience. Do not
use it to justify adding scope.

---

## What we deliberately do NOT optimize for

| What | Why not |
|---|---|
| Comprehensive multi-language SAST | Requires a parser per language, a maintained rule set per language, and a corpus per language. One dependency (`acorn`) is already the upper bound for this product line. Adding a second language means a second parser, second corpus, and second support surface. |
| Cross-file / whole-program dataflow | The moment verification needs to read files the diff did not touch, the verdict depends on the full repo state — not the diff. That breaks the local, fast, reproducible guarantee. `ast-dataflow` stops at the file boundary by design. |
| CVE / dependency-DB coverage | `npm audit` already does this. A second CVE lookup adds a network call, a database to keep current, and a new failure mode (stale DB = false assurance). `package-lockfile-risk` flags risky shapes without claiming to know current CVEs. |
| An LLM that decides the verdict | An LLM-decided verdict is not reproducible. Same diff, same day, different verdict. The moat is the opposite: same diff, any day, same verdict. Routing to a human for ambiguous cases is the correct answer, not asking an LLM to guess. |

---

*Reference: `BENCHMARK.md` for rule recall numbers and corpus composition. `RUBRIC.md`
for the adversarial review scoring rubric and quarterly health-check protocol.*
