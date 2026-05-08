# Case Study: Diary Local App

Status date: 2026-05-08

Target repository:

```text
local user-provided Diary app
```

Target commit:

```text
509eb32b5267603b5b09dac2aba80e5d961573fa
```

Package:

```text
diary@0.1.0
private: true
purpose: one-person local diary web app
stack: React + Express + SQLite + TypeScript
```

## Why This Target

This is a local full-stack app produced with the NEKOWORK skill/process rather than a public third-party dependency. It is useful as a product-output case study because it shows a complete local-first application with server, web, shared types, tests, and explicit security boundaries.

The target README records these safety assumptions:

```text
server binds to 127.0.0.1 only
no authentication because the app is local-only
no external network calls
```

This case study does not claim upstream adoption or public third-party validation. It records that a user-provided local app can be validated as a real generated project without publish, deploy, push, or apply automation.

## Commands Run

From the target repository:

```bash
npm test
npm run typecheck
npm run lint
```

## Target Test Result

```text
npm test
-> server: 5 test files passed, 51 tests passed
-> web: 12 test files passed, 58 tests passed
-> total: 17 test files passed, 109 tests passed
```

Type checking:

```text
npm run typecheck
-> packages/shared: pass
-> apps/server: pass
-> apps/web: pass
```

Lint:

```text
npm run lint
-> apps/server: pass
-> apps/web: pass
```

Warnings observed during the web test run:

```text
React Router v7 future flag warnings
React act(...) warnings in selected async UI tests
Node experimental SQLite warnings
```

These warnings did not fail the test suite.

## Target State

Git status in the target after validation:

```text
M apps/server/package.json
```

The local change removes `--no-warnings` from the server `tsx` dev/start scripts. NEKOWORK documentation treats this as user-owned target state and does not revert it.

Recent target commits include:

```text
509eb32 test: XSS challenge regression for javascript:/data: URL plus lint cleanup
4250a5a fix(autosave): do not abort cleanup flush when entering disabled state
32f1155 fix(autosave): strengthen P1/P2 baseline adoption and cancelInflight
7582e45 fix(review): Codex P1/P2 follow-up for engine, autosave, flush ref, server build
70f873b feat: initial diary v1 implementation
```

## Interpretation

This is a positive generated-app validation:

- the app has a clear local-only threat model
- server, web, and shared package boundaries are present
- server and web tests both pass
- full TypeScript type checking passes
- lint passes
- no publish, deploy, push, PR, or apply operation was performed by this validation

The value of this case study is not that NEKOWORK proved the app correct. It shows that the generated project has enough structure, tests, and safety boundaries to be audited and validated like a real local-first application.
