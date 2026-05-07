# Case Study: python-hyper/h11

Status date: 2026-05-07

Target repository:

```text
https://github.com/python-hyper/h11
```

Target commit:

```text
62c5068c971579d61fa1b55373390e12f25fd856
```

Package:

```text
h11@0.16.0+dev
license: MIT
purpose: pure-Python HTTP/1.1 protocol implementation
```

## Why This Target

This is a third-party Python library with a clear protocol boundary: parsing HTTP/1.1 events, headers, connection states, receive buffers, and malformed request/response flows. It is useful as a non-Node case study because it exercises NEKOWORK against a real Python repository while keeping the expected mutation surface small.

This case study does not create an upstream PR. It proves that NEKOWORK can inspect a Python protocol project, record quality-profile evidence, keep the target source untouched, and refuse ship readiness when strict quality coverage evidence is incomplete.

## Commands Run

From a temporary clone of the target:

```bash
git clone --depth=1 https://github.com/python-hyper/h11.git <target>
cd <target>
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e . -r test-requirements.txt
.\.venv\Scripts\python.exe -m pytest h11\tests
```

From the NEKOWORK checkout:

```bash
node scripts/cli.js doctor --quick --project-root <target> --json
node scripts/portability/simulate-port.js <target> --profile quality --json
node scripts/cli.js ask "assess h11 HTTP/1.1 parser boundary and malformed request handling" --profile quality --session nekowork-h11-case --project-root <target> --json
node scripts/cli.js run "assess h11 HTTP/1.1 parser boundary and malformed request handling" --profile quality --strict-quality --session nekowork-h11-case --project-root <target> --json
node scripts/cli.js gate status --session nekowork-h11-case --project-root <target> --json
```

## Target Test Result

```text
python -m pip install -e . -r test-requirements.txt
-> installed h11 editable plus pytest and pytest-cov

python -m pytest h11\tests
-> 9 test files passed
-> 78 tests passed
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
profile: quality
component_count: 43
detected files: pyproject.toml
```

Ask summary:

```text
risk_level: low
tags: none
requires_human_gate: false
questions include test-first plan and acceptance-evidence prompts
```

Run summary:

```json
{
  "sessionId": "nekowork-h11-case",
  "profile": "quality",
  "strict_quality": true,
  "strict_quality_blocked": true,
  "verdict": "approve_with_fixes",
  "ship_ready": false,
  "no_ship": true,
  "human_gate": false,
  "apply_requested": false,
  "applied": false
}
```

Verify summary:

```text
profile: quality
risk_level: low
risk_tags: []
codex_review_run: true
codex_challenge_run: false
strict_quality: true
strict_quality_blocked: true
quality_warnings:
  - AC-001 lacks explicit verification evidence
  - AC-002 lacks explicit verification evidence
  - AC-003 lacks explicit verification evidence
acceptance_coverage:
  - AC-001: missing
  - AC-002: missing
  - AC-003: missing
verdict: approve_with_fixes
target_project_mutated: false
```

Ship summary:

```text
ship_ready: false
no_ship: true
reason: verification verdict is approve_with_fixes
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

This is the expected safe result for a non-Node strict-quality external run using mock providers:

- The target's Python test suite passed independently with `78 tests passed`.
- NEKOWORK detected a Python project through `pyproject.toml`.
- The quality profile added test-first and acceptance-evidence prompts.
- `strict-quality` escalated missing acceptance coverage evidence into a fix-required verdict.
- Ship readiness was refused, apply was not requested, and the target source remained untouched.

The value of this case study is that NEKOWORK's quality runtime behavior is language-agnostic: passing target tests are useful evidence, but they do not automatically bypass acceptance coverage, verification, ship, or apply controls.
