# NEKOWORK Adversarial Review Rubric (NORMATIVE)

> Status: **Normative.** This is the scoring rubric for NEKOWORK's periodic
> adversarial self-review. It is written to measure the product against **its own
> stated scope** — a *local, deterministic, lightweight verification gate* — not
> against "comprehensive security scanner," a goal NEKOWORK **explicitly
> disclaims in code and docs** (citations below).
>
> Read the "Guardrails against rubric-gaming" section before changing anything
> here. Publish this rubric **before** a review round, never after seeing scores.

---

## Why this rubric is recalibrated (and why that is NOT goalpost-moving)

A rubric is only honest if it measures what the product *claims to be*. NEKOWORK
declares a **bounded scope in code, before any score is computed** — so scoring it
as if it were Semgrep/CodeQL would be the rubric error, not a generous read.
Verify each citation yourself:

- **`packages/nekowork/scripts/lib/verify-helpers.js` — `ALLOW_SCOPE_NOTE`
  (lines 31–41).** The ALLOW / ALLOW_WITH_WARNINGS verdict literally prints:
  *"This is NOT an exhaustive security audit — logic bugs, auth/authorization
  flaws, and any vector outside these rules are out of scope. A clean result
  means 'nothing the rules catch', not 'this code is safe'."* (lines 39–41).
  This disclaimer is emitted **in the verdict output** (`renderReport`, line ~352)
  — i.e. the scope boundary predates and is independent of any review score.
- **`packages/nekowork/scripts/lib/verify-helpers.js` — `deriveRiskVerdict`
  (lines 169–217).** The verdict is a **pure deterministic function** of
  `{ findings, classified, checksAvailable }`. Zero LLM input. Same diff →
  same verdict. The exit-code map (lines 51–57) and `RULE_COUNT = 11` (line 29)
  are likewise fixed constants.
- **`packages/nekowork-cli/docs/BENCHMARK.md` — "What is NOT covered"
  (lines 130–162)** + corpus-provenance disclosure (lines 65–128). The corpus
  is **62% synthetic** (line 82; 140 / 226 positives), only ~**4 live-AI
  positives** (lines 110–111), and `hardcoded-credential` is **synthetic-only by
  design** (lines 113–128). The page states plainly that the ≤30% synthetic
  target is **not** met (lines 198, 213).
- **`packages/nekowork-cli/docs/SCOPE-1.0.md` — "1.0 제외" (lines 181–188)** and
  the fixture-source policy / §9 (lines 244–265): auth-bypass, most injection
  classes, cross-file dataflow, dangerous-shell, CI/CD hardening, prompt
  injection are **explicitly deferred to 1.x or another verb**.
- **`packages/nekowork-cli/package.json` "description"** + **README.md
  (lines 17–19):** identity is a *"Local verification gate for AI-written code
  diffs. Deterministic rules decide the verdict, never the LLM."* — **not** an
  exhaustive scanner.

Because the scope boundary is asserted in code **before** scoring, recalibrating
the rubric to that boundary is honest measurement. Moving goalposts would be
*changing* the boundary after a bad score; here we are *matching the boundary the
product already published*.

---

## The 7 dimensions

Composite = unweighted mean of the 7 dimension scores (1–10), unless the review
round documents a different weighting **before** scoring.

Two dimensions are recalibrated (`detection-precision`, `verdict-integrity`).
Five keep their normal meaning.

---

### 1. detection-precision (recalibrated; was "detection-rules")

**What it measures:** precision/recall of the **defined rule set** on its
**claimed scope** — JS/TS plus the supported non-JS regex patterns, intra-module
(single-file) analysis, **diff-added lines** — *plus* corpus quality *plus*
boundary-disclosure honesty.

> **Axis statement (must be honored):** *Comprehensive breadth across all
> languages and vectors is NOT the axis. Breadth across every language and every
> vector is a different product (Semgrep / CodeQL). Penalizing un-claimed
> completeness is a rubric error.* Score how well the rules do **what they claim**,
> how clean the corpus is, and how honestly the gaps are disclosed.

**REWARDS:**
- 100% recall / 0% FP on the corpus for the claimed scope.
- Real-OSS fixtures (provenance recorded per fixture: `synthetic` /
  `github:<repo>@<sha>` / `live-ai`).
- Honest, specific "not covered" docs (the BENCHMARK "What is NOT covered"
  section is the model).
- A reproducible benchmark (`npm run bench:rules`) wired into CI.

**STILL PENALIZES (no free pass for honesty — disclosure ≠ remediation):**
- Corpus **62% synthetic** while the product's own SCOPE-1.0 §9 target is **≤30%**
  (BENCHMARK lines 82, 198, 213). Disclosing it does not neutralize it.
- **~4 live-AI fixtures** across 3 rules vs. the §9 target of 30+ — recall says
  little about how Claude Code / Cursor / Codex actually fail.
- `hardcoded-credential` **synthetic-only** (even if for a defensible ethical
  reason): its recall says nothing about wild code.
- Supporting rules below the OSS-positive bar (only `secret-fallback` meets 30+).
- Any FP regression, any silently-dropped finding, or recall claimed beyond the
  measured corpus.

**Anchors:**
- **3** — Rules exist and fire, but corpus is essentially all synthetic and/or
  "not covered" boundaries are vague or absent. Recall numbers are
  self-referential (own rules on own fixtures) with no provenance.
- **5** — 100% recall / 0% FP on a mostly-synthetic corpus; boundaries disclosed
  but the corpus is ~60%+ synthetic, live-AI ≈ a handful, several rules
  synthetic-only. (This is approximately **where NEKOWORK sits today.**)
- **7** — Synthetic share materially down (≈40–50%), most rules carry ≥10 real
  OSS positives, ≥1 rule has real live-AI fixtures, benchmark in CI with history,
  boundary docs precise and per-rule.
- **9** — Synthetic ≤30% (the §9 target met), the killer rule + supporting rules
  carry 30+ OSS positives, a real live-AI corpus (≥30) exists, FP=0 sustained
  across CI history. Breadth is still *not* required — depth/honesty on the
  claimed scope is maxed.

---

### 2. verdict-integrity (recalibrated; was "moat-integrity")

**What it measures:** the four properties of the **verdict mechanism**:
1. **Deterministic** — same diff → same verdict, every run (no LLM, no clock, no
   network in the verdict path).
2. **Content-hash bound** — an approval is bound to the **exact diff**; it cannot
   silently apply to a different diff.
3. **LLM-excluded** — no LLM output reaches the verdict (Codex/advisor is a
   recorded note only; "LLM 의견 = verdict 아님").
4. **Bounded scope disclosed in the verdict output** — the ALLOW verdict itself
   prints `ALLOW_SCOPE_NOTE`.

The code delivers all four: `deriveRiskVerdict` is pure (verify-helpers.js
169–217); the verdict path has no LLM; `ALLOW_SCOPE_NOTE` is rendered into the
report (line ~352).

> **Axis statement (must be honored):** *The moat is the UN-FOOLABLE VERDICT
> MECHANISM, not un-foolable detection.* A finding like "I crafted a diff the
> rules miss" is a **detection** gap → score it under **detection-precision**,
> not here. Scoring an evasion here is **double-counting**, and it measures an
> **un-claimed property** (NEKOWORK never claims its detection is un-evadable; it
> claims its *verdict* is un-foolable). Only score evidence that bears on
> determinism / hash-binding / LLM-exclusion / disclosure here.

**REWARDS:**
- Pure deterministic verdict function (no LLM, no nondeterministic input).
- Approval/decision bound to the exact diff content (hash binding).
- LLM strictly advisory, provably outside the verdict path.
- Scope disclosed *in the verdict output*, not just in docs.

**STILL PENALIZES:**
- **Any** path where the verdict could be non-deterministic (timestamp, env,
  network, ordering, or LLM leaking into `deriveRiskVerdict`'s inputs).
- **Any** path where an approval could apply to a **different** diff than the one
  it was issued for (missing/weak content-hash binding, TOCTOU between
  approve and apply).
- Scope disclosure present in docs but **missing from the verdict output**.
- An advisor note that can influence the verdict.

**Anchors:**
- **3** — Verdict is deterministic in the common case but an LLM or
  nondeterministic input can reach it on some path, or approvals are not bound to
  diff content.
- **5** — Deterministic verdict, LLM excluded, but hash-binding or
  approve→apply integrity is partial / undocumented.
- **7** — All four properties hold in code with tests; one is under-tested or
  relies on convention rather than enforcement.
- **9** — All four properties hold, **enforced and tested**: determinism covered
  by a same-diff→same-verdict test, content-hash binding tested against a
  swapped-diff attack, LLM-exclusion structurally guaranteed, `ALLOW_SCOPE_NOTE`
  asserted present in rendered output. (The code today is close to this; gaps are
  in *test coverage of the attack paths*, not the design.)

---

### 3. architecture (normal meaning)

**Measures:** module boundaries, the shared-helper single-source-of-truth design
(slim + heavy both import `verify-helpers.js` so verdict logic can't drift), dep
direction, leanness (1 small dependency: `acorn`).

- **3** — Logic duplicated across packages; drift possible.
- **5** — Shared core exists but boundaries leak; some duplication.
- **7** — Clean shared core, one auditable dep, clear slim/heavy split.
- **9** — Boundaries enforced (lint/dep-cruiser), zero drift, leanness verified.

---

### 4. core-engine (normal meaning)

**Measures:** correctness/robustness of diff parsing, file classification,
rule dispatch, AST/taint engine, evidence emission.

- **3** — Engine works on happy path; crashes or mis-parses on edge diffs
  (binary, rename, empty, patch-only).
- **5** — Handles common cases; some edge cases mishandled.
- **7** — Robust across diff modes, binary/rename/empty handled, AST no-ops
  gracefully without project root.
- **9** — Hardened: fuzzed diff inputs, deterministic ordering, no crashes on
  malformed input, evidence manifest complete and stable.

---

### 5. security (normal meaning — of NEKOWORK itself)

**Measures:** NEKOWORK's **own** safety: no injection/RCE in the tool, no
auto-commit/push/deploy, no secret exfiltration, self-output not re-scanned into
false findings, no command execution from untrusted diff content.

- **3** — A plausible injection/RCE or auto-mutation path in the tool itself.
- **5** — No obvious holes but unproven; some risky surfaces unaudited.
- **7** — Audited clean (injection/RCE 0), no auto-mutation, self-output excluded
  from scanning.
- **9** — Audited clean + regression tests for each closed hole (self-pollution,
  path traversal, approval binding), threat model documented.

---

### 6. tests-ci (normal meaning)

**Measures:** test density on the verdict/rule paths, benchmark-in-CI, branch
protection, green-history discipline.

- **3** — Sparse tests; no CI gate on detection quality.
- **5** — Good unit tests; benchmark exists but not enforced in CI; no branch
  protection.
- **7** — Verdict + rules well-tested, `bench:rules` runs in CI, CI green.
- **9** — Above + branch protection on, benchmark history published, 3+
  consecutive CI PASS on the detection gate.

---

### 7. docs-product (normal meaning)

**Measures:** honesty and usability of docs; scope/identity consistency across
README / SCOPE / BENCHMARK / verdict output; no drift between claimed and shipped.

- **3** — Docs oversell (read as "exhaustive scanner"); scope drift across files.
- **5** — Mostly accurate; some version/claim drift.
- **7** — Identity consistent everywhere, "What is NOT covered" explicit, verdict
  output discloses scope.
- **9** — Above + provenance disclosed per fixture, version lines consistent
  (slim vs heavy), every claim traceable to a benchmark or code citation.

---

## Ceiling & honesty

With **this** rubric, the realistic **composite ceiling for THIS product** —
lightweight, deterministic, local, **1 small dependency** — is **~8.0–8.3**.

- **Composite 9 would require becoming a different product:** multi-language SAST
  + cross-file / whole-program dataflow + possibly an LLM judge. That directly
  **contradicts NEKOWORK's identity** (deterministic, LLM-excluded verdict; lean;
  bounded scope disclosed in code). Chasing a 9 here means abandoning the moat.
- **~8.3 is not free, either.** Reaching it still requires real work:
  - rebalance the corpus toward **≤30% synthetic** (currently 62%),
  - add a real **live-AI fixture corpus** (currently ~4),
  - turn on **branch protection** and publish benchmark history,
  - close the test gaps on the verdict-integrity attack paths (swapped-diff,
    determinism).
- **Today's honest read:** detection-precision ≈ 5 (mechanically perfect on a
  partial corpus), verdict-integrity ≈ 7 (design solid, attack-path tests thin).
  The other five must be **genuinely earned** — no dimension gets a free pass for
  being "in scope."

Do not report a composite above ~8.3 without either (a) a documented scope change
or (b) evidence that the product crossed into multi-language/cross-file/LLM-judge
territory — in which case the **identity**, not just the score, has changed.

---

## Guardrails against rubric-gaming

1. **Rubric changes require documented evidence of scope-mismatch.** A dimension
   may only be recalibrated by citing a scope boundary the product asserted
   **before** scoring — exactly as `ALLOW_SCOPE_NOTE` (verify-helpers.js 31–41)
   and SCOPE-1.0 "1.0 제외" (lines 181–188) predate this rubric. "The score was
   low so we relaxed the dimension" is forbidden.
2. **Recalibrated dimensions must STILL penalize real gaps.** The recalibration
   narrows the *axis* (claimed scope), it does **not** remove penalties. The
   62%-synthetic corpus, thin live-AI set, and missing attack-path tests must
   keep costing points. A recalibration that turns into a free pass is rejected.
3. **No double-counting across the two recalibrated dims.** A detection bypass is
   scored once, under `detection-precision`. A verdict-mechanism flaw is scored
   once, under `verdict-integrity`. Never both.
4. **Publish the rubric BEFORE a review round.** Commit this file (or its
   per-round copy) before any scoring begins. Post-hoc edits to the rubric within
   a round invalidate that round's scores.
5. **Breadth is never rewarded as such.** Adding a new language or vector earns
   points only via `detection-precision` (better recall/corpus on the *claimed*
   scope) — never as "more comprehensive," which is an un-claimed property.

---

## How to run a review with this rubric

1. **Freeze the rubric.** Confirm this file is committed (or snapshot a per-round
   copy) **before** scoring. Note the slim package version and the commit SHA.
2. **Reproduce the benchmark:** from `packages/nekowork/`, run
   `npm run bench:rules -- --json`. This is the single source of truth for
   detection-precision's recall/FP and corpus composition.
3. **Verify the integrity properties in code**, not from docs: re-read
   `deriveRiskVerdict` (verify-helpers.js 169–217) for purity, confirm no LLM in
   the verdict path, confirm `ALLOW_SCOPE_NOTE` is rendered (renderReport ~352),
   and check approve→apply hash binding.
4. **Score each of the 7 dimensions 1–10** using the anchors. For the two
   recalibrated dims, apply the axis statements verbatim (don't reward breadth,
   don't double-count evasion under integrity).
5. **Compute the composite** (mean unless a weighting was documented up front).
6. **Sanity-check against the ceiling:** a composite > ~8.3 demands either a
   documented scope change or proof the product became a different category.
7. **Record the round:** rubric SHA, package version, per-dimension scores with
   one-line evidence each, and the composite. File findings; do not edit this
   rubric to fit them.
