# Case Study: sindresorhus/is-plain-obj

> **Legacy session-flow case study.** Documents the session orchestration (`ask` / `run --profile <p> --strict-quality --secure` / `gate status` / `report --session`) — the compatibility surface in [ADVANCED.md](../ADVANCED.md), scheduled for removal in 2.0 ([SCOPE-1.0.md](../SCOPE-1.0.md)). The `approve_with_fixes` / `ship_ready` / `no_ship` fields are legacy session verdicts, **not** `verify-pr` output. For verify-pr evidence: real OSS corpus in [BENCHMARK.md](../BENCHMARK.md), example report in [DEMO-REPORT.md](../DEMO-REPORT.md).

Status date: 2026-05-07

Target repository:

```text
https://github.com/sindresorhus/is-plain-obj
```

Target commit:

```text
97f38e8836f86a642cce98fc6ab3058bc36df181
```

Package:

```text
is-plain-obj@4.1.0
license: MIT
purpose: Check if a value is a plain object
```

## Why This Target

This is a small third-party Node package with a clear public API, local tests, and a permissive license. It is useful as a first real external case study because the expected blast radius is small and the test command is explicit.

This case study does not create an upstream PR. It proves that NEKOWORK can run against a real external codebase, record session evidence, and refuse ship readiness when strict quality evidence is incomplete.

## Commands Run

From a temporary clone of the target:

```bash
git clone --depth=1 https://github.com/sindresorhus/is-plain-obj.git <target>
cd <target>
npm install
npm test
```

From the NEKOWORK checkout:

```bash
node packages/nekowork-cli/scripts/cli.js doctor --quick --project-root <target> --json
node scripts/portability/simulate-port.js <target> --profile developer --json
node packages/nekowork-cli/scripts/cli.js ask "assess is-plain-obj plain object boundary coverage" --profile quality --session nekowork-is-plain-obj-case --project-root <target> --json
node packages/nekowork-cli/scripts/cli.js run "assess is-plain-obj plain object boundary coverage" --profile quality --strict-quality --session nekowork-is-plain-obj-case --project-root <target> --json
node packages/nekowork-cli/scripts/cli.js gate status --session nekowork-is-plain-obj-case --project-root <target> --json
```

## Target Test Result

```text
npm install
-> found 0 vulnerabilities

npm test
-> xo && ava && tsd
-> 1 test passed
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
profile: developer
component_count: 43
```

Run summary:

```json
{
  "sessionId": "nekowork-is-plain-obj-case",
  "profile": "quality",
  "strict_quality": true,
  "strict_quality_blocked": true,
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
quality_warnings:
- AC-001 lacks explicit verification evidence
- AC-002 lacks explicit verification evidence
- AC-003 lacks explicit verification evidence

acceptance_coverage:
- AC-001: missing
- AC-002: missing
- AC-003: missing
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

This is the expected safe result for a strict-quality external run using mock providers:

- The target project's own tests passed.
- NEKOWORK created inspectable evidence under `.harness/state/sessions/`.
- `strict-quality` refused ship readiness because acceptance evidence was not explicit enough.
- Human Gate was not required because the task was low risk.
- No target project source mutation, PR, publish, deploy, or apply occurred.

The value of this case study is not that NEKOWORK changed the package. The value is that NEKOWORK treated a real third-party project as a controlled target and produced a no-ship decision when quality evidence was incomplete.
