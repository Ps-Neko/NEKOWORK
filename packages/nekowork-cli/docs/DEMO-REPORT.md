# Demo Report

`verify-pr` is the 1.0 evidence surface. It scans a diff with deterministic risk rules and writes two artifacts at the project root — a human-readable `REPORT.md` and a machine-readable `.nekowork/decision.json` — without calling providers, applying the diff, or mutating source. The verdict comes from the rules (and optional `--run-checks` results), never from an LLM.

> Legacy session-based reporting (`report --session <id>`, `build`, `ship`) is a compatibility surface documented in [ADVANCED.md](ADVANCED.md); it is scheduled for removal in 2.0 ([SCOPE-1.0.md](SCOPE-1.0.md)).

## Command

After your AI tool writes a change — here a `process.env.X || "fallback"` slipped into `src/auth.ts` — run:

```bash
npx -y @ps-neko/nekowork@alpha verify-pr
cat REPORT.md
cat .nekowork/decision.json
```

`verify-pr` reads the working-tree diff by default. Other inputs: `--from-staged`, `--from-patch <file>`, `--range <ref>`.

## Terminal summary

The verdict prints first:

```text
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback detected (src/auth.ts:4)
  risk_level     : CRITICAL
  merge_allowed  : false
  apply_allowed  : false
  changed_files  : 1 (+3 -1)
  findings       : critical=1 high=0 medium=0 low=0
  top findings:
    - [CRITICAL] Hardcoded secret fallback detected (src/auth.ts:4)
  report         : REPORT.md
  decision       : .nekowork/decision.json
```

The exit code follows the verdict: `BLOCK` = 2, `NEEDS_HUMAN_REVIEW` / `INSUFFICIENT_EVIDENCE` = 1, `ALLOW` / `ALLOW_WITH_WARNINGS` = 0.

## `REPORT.md`

This is the exact file `verify-pr` wrote for the run above:

```md
# NEKOWORK Verification Report

## Verdict

**BLOCK**

## Reason

Hardcoded secret fallback detected (src/auth.ts:4)

## Decision

- merge_allowed: false
- apply_allowed: false
- risk_level: CRITICAL

## Changed Files

- total: 1
- additions: 3
- deletions: 1
- source: src/auth.ts

## Blocking Findings

- **CRITICAL** [secret-fallback] Hardcoded secret fallback detected — `src/auth.ts:4`
  - Remove the hardcoded fallback. Fail closed when the secret is absent (throw or exit).

## Evidence

- `.nekowork/evidence/risk-findings.json`
- `.nekowork/evidence/diff.summary.json`
- `.nekowork/evidence/evidence-manifest.json`
- `.nekowork/decision.json`

## Checks Available

- test: configured
- lint: configured
- typecheck: not configured
- build: not configured
- audit: configured
```

With `--run-checks`, the `## Checks Available` section is replaced by `## Checks Run` (test / lint / typecheck results). Checks are escalation-only: a failing check turns `ALLOW` into `NEEDS_HUMAN_REVIEW`, never a standalone `BLOCK`. When the diff has a CRITICAL finding or tampers with build/test scripts, checks are skipped and the report records the reason.

## `.nekowork/decision.json`

The machine-readable companion (`schema_version: verify-pr-v0`). `generated_at` and each finding's `id` / `category` / `description` fields are elided for brevity:

```json
{
  "schema_version": "verify-pr-v0",
  "verdict": "BLOCK",
  "reason": "Hardcoded secret fallback detected (src/auth.ts:4)",
  "apply_allowed": false,
  "merge_allowed": false,
  "risk_level": "CRITICAL",
  "finding_counts": { "critical": 1, "high": 0, "medium": 0, "low": 0 },
  "changed_files": {
    "total": 1, "additions": 3, "deletions": 1,
    "source": ["src/auth.ts"], "tests": [], "docs": [], "config": [], "ci": []
  },
  "project": {
    "type": "node",
    "package_manager": null,
    "checks_available": { "test": true, "lint": true, "typecheck": false, "build": false, "audit": true }
  },
  "findings": [
    {
      "rule": "secret-fallback",
      "pattern": "env-or-literal",
      "severity": "critical",
      "file": "src/auth.ts",
      "line": 4,
      "title": "Hardcoded secret fallback detected",
      "recommendation": "Remove the hardcoded fallback. Fail closed when the secret is absent (throw or exit).",
      "blocks_apply": true,
      "match": "process.env.JWT_SECRET || 'dev-secret-change-in-production'"
    }
  ],
  "checks": { "requested": false, "skippedReason": null, "results": [] }
}
```

`apply` refuses to run unless `apply_allowed` is `true`.

## Safety contract

`verify-pr` is read-only against your project:

- no provider calls (deterministic rules)
- no git mutation (it only reads the diff)
- no diff apply
- no PR, release, publish, or deploy

It writes only `REPORT.md` and `.nekowork/` — add `.nekowork/` to `.gitignore`, or pass `--no-write` to suppress all artifacts. "Verified" here means independent review with recorded evidence, not mathematically proven correctness.
