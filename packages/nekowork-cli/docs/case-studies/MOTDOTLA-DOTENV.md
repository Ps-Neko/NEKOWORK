# Case Study: motdotla/dotenv

> **Legacy session-flow case study.** Documents the session orchestration (`ask` / `run --profile <p> --strict-quality --secure` / `gate status` / `report --session`) — the compatibility surface in [ADVANCED.md](../ADVANCED.md), scheduled for removal in 2.0 ([SCOPE-1.0.md](../SCOPE-1.0.md)). The `approve_with_fixes` / `ship_ready` / `no_ship` fields are legacy session verdicts, **not** `verify-pr` output. For verify-pr evidence: real OSS corpus in [BENCHMARK.md](../BENCHMARK.md), example report in [DEMO-REPORT.md](../DEMO-REPORT.md).

Status date: 2026-05-08

Target repository:

```text
https://github.com/motdotla/dotenv
```

Target commit:

```text
10f5c0fb341089a16defab128a0cfe9e548c49ec
```

Package:

```text
dotenv@17.4.2
license: BSD-2-Clause
purpose: Loads environment variables from .env files
```

## Why This Target

This is a third-party Node package with a configuration and secret-loading boundary: parsing `.env` files, preserving or overriding existing process environment values, handling `.env.vault`, and reporting path or decryption errors.

This case study adds a new risk class beyond the existing package, auth parser, and protocol parser studies: environment configuration behavior. It is useful because `.env` handling can affect secrets, process state, and deployment configuration even when the code surface is small.

This case study does not create an upstream PR. It proves that NEKOWORK can inspect a real configuration-boundary project, classify it as security-sensitive, run Codex review plus Codex challenge, and refuse ship readiness when verification reports fixable findings.

## Commands Run

From a temporary clone of the target:

```bash
git clone --depth=1 https://github.com/motdotla/dotenv.git <target>
cd <target>
npm install
npm test
```

From the NEKOWORK checkout:

```bash
node scripts/cli.js doctor --quick --project-root <target> --json
node scripts/portability/simulate-port.js <target> --profile security --json
node scripts/cli.js ask "assess dotenv .env loading, override behavior, and secret configuration boundary" --profile security --session nekowork-dotenv-case --project-root <target> --json
node scripts/cli.js run "assess dotenv .env loading, override behavior, and secret configuration boundary" --profile security --strict-quality --secure --session nekowork-dotenv-case --project-root <target> --json
node scripts/cli.js gate status --session nekowork-dotenv-case --project-root <target> --json
node scripts/cli.js report --session nekowork-dotenv-case --project-root <target> --stdout
```

## Target Test Result

```text
npm install
-> added 765 packages
-> 27 vulnerabilities in target dev dependencies: 1 low, 7 moderate, 18 high, 1 critical

npm test
-> lint passed
-> dts-check passed
-> tap run tests/**/*.js
-> total: 199
-> pass: 197
-> fail: 2
```

The two target failures were Windows path expectation mismatches in `tests/test-config.js` for `file://` path handling:

```text
expected: ENOENT: no such file or directory, open 'file:///tests/.env'
actual:   ENOENT: no such file or directory, open '<target>\file:\tests\.env'
```

## NEKOWORK Result

Doctor:

```text
summary: WARN
pass: 6
warn: 1
fail: 0
warning: Gemini CLI auth was not checked non-interactively
```

Portability preflight:

```text
strategy: submodule
conflicts: none
profile: security
component_count: 44
detected files: package.json
```

Ask summary:

```text
risk_level: high
tags: security
requires_human_gate: false
questions include auth, token, permission, or secret boundary scope
```

Run summary:

```json
{
  "sessionId": "nekowork-dotenv-case",
  "profile": "security",
  "strict_quality": true,
  "strict_quality_blocked": false,
  "verify_verdict": "approve_with_fixes",
  "ship_ready": false,
  "no_ship": true,
  "human_gate": false,
  "apply_requested": false,
  "applied": false,
  "target_project_mutated": false
}
```

Verify summary:

```text
profile: security
risk_level: high
risk_tags: security
codex_review_run: true
codex_challenge_run: true
secure_active: true
quality_warnings: []
verdict: approve_with_fixes
target_project_mutated: false
```

Ship summary:

```text
ship_ready: false
no_ship: true
reason: verification verdict is approve_with_fixes
gate_status: clear
target_project_mutated: false
```

Report summary:

```text
Status: no_ship
Verdict: approve_with_fixes
Human Gate: no
Ship Ready: no
Applied: no
Target Project Mutated: no
Evidence: ask.json, work-summary.json, verify-summary.json, ship-summary.json, run-summary.json, acceptance-criteria.json, NO_SHIP
```

Gate status:

```text
status: clear
humanGate: false
```

Git status in the target after the run:

```text
?? .harness/
```

Only NEKOWORK session evidence was written. No package source files were modified and no apply step was requested.

## Interpretation

This is the expected safe result for a configuration and environment-loading boundary run using the security profile:

- The target's lint and type declaration checks passed.
- The target's own tests exposed two Windows `file://` path expectation failures.
- The target's dev dependency audit reported moderate+ vulnerabilities.
- NEKOWORK classified the task as high-risk security work because environment and secret boundaries were in scope.
- `run --secure` executed both Codex review and Codex challenge.
- Ship readiness was refused because verification returned `approve_with_fixes`.
- Human Gate was not opened because no critical or block finding was recorded.
- No target project source mutation, PR, publish, deploy, or apply occurred.

The value of this case study is that NEKOWORK treats environment configuration as a security-sensitive boundary. Passing lint and type checks are useful, but target test failures and fix-required verification keep the run in no-ship state.
