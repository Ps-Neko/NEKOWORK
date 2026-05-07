# Case Study: jshttp/basic-auth

Status date: 2026-05-07

Target repository:

```text
https://github.com/jshttp/basic-auth
```

Target commit:

```text
1ba386f174d4b3633037c7231ac6718549520bf0
```

Package:

```text
basic-auth@2.0.1
license: MIT
purpose: node.js basic auth parser
```

## Why This Target

This is a small third-party Node package with a clear auth boundary: parsing the `Authorization` header and rejecting malformed Basic credentials. It is useful as an auth/security case study because the expected blast radius is narrow, but mistakes can affect authentication behavior.

This case study does not create an upstream PR. It proves that NEKOWORK can run a security-profile workflow against a real auth-focused project, run Codex review plus Codex challenge, and refuse ship readiness when verification reports fixable findings.

## Commands Run

From a temporary clone of the target:

```bash
git clone --depth=1 https://github.com/jshttp/basic-auth.git <target>
cd <target>
npm install
npm test
npm run specs
```

From the NEKOWORK checkout:

```bash
node scripts/cli.js doctor --quick --project-root <target> --json
node scripts/portability/simulate-port.js <target> --profile security --json
node scripts/cli.js ask "assess basic-auth Authorization parser boundary and malformed credential handling" --profile security --session nekowork-basic-auth-case --project-root <target> --json
node scripts/cli.js run "assess basic-auth Authorization parser boundary and malformed credential handling" --profile security --strict-quality --secure --session nekowork-basic-auth-case --project-root <target> --json
node scripts/cli.js gate status --session nekowork-basic-auth-case --project-root <target> --json
```

## Target Test Result

```text
npm install
-> found 0 vulnerabilities

npm test
-> ts-scripts test
-> failed during prettier formatting checks on Windows CRLF line endings

npm run specs
-> vitest run .
-> 2 test files passed
-> 28 tests passed
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
component_count: 43
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
  "sessionId": "nekowork-basic-auth-case",
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

This is the expected safe result for a security-profile external run using mock providers:

- The target's auth parser specs passed independently with `npm run specs`.
- The target's full `npm test` was not clean in this Windows clone because the formatting gate reported CRLF issues.
- NEKOWORK classified the task as high-risk security work.
- `run --secure` executed both Codex review and Codex challenge.
- Ship readiness was refused because verification returned `approve_with_fixes`.
- Human Gate was not opened because no critical or block finding was recorded.
- No target project source mutation, PR, publish, deploy, or apply occurred.

The value of this case study is that NEKOWORK treated an auth-boundary project conservatively: passing specs alone were not enough to ship, and the verification verdict kept the run in no-ship state.
