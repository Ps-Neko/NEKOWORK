# Alpha Feedback Triage

Status date: 2026-05-14

This guide turns public alpha feedback into evidence-backed next steps without weakening NEKOWORK's safety model.

Use it for GitHub issues filed through:

- Alpha feedback
- External run evidence
- Bug report
- Direct maintainer notes that include `check --json`, `REPORT.md`, or install output

## Triage Principles

- Redact first. Remove secrets, tokens, private paths, proprietary code, and private repository names before copying issue content into docs or release notes.
- Reproduce before changing behavior. Prefer a fresh `npx @alpha` smoke, a source-checkout smoke, or a disposable target project.
- Keep no-ship evidence visible. A confusing or blocked run is still useful if it records `REPORT.md`, `NO_SHIP`, `verify-summary.json`, or `ship-summary.json`.
- Do not convert feedback into automatic apply, publish, deploy, push, or PR behavior.
- Do not make API keys the default provider path. Delegated local CLI auth remains the recommended path.

## Initial Classification

| Class | Signals | First response |
|---|---|---|
| Install failure | `npx`, npm, Node version, package metadata, binary resolution | Ask for OS/shell, Node/npm, exact command, and `check --json` |
| Auth confusion | Claude/Codex/Gemini login status, API key warning, provider CLI path | Clarify delegated CLI auth and ask whether env API keys were set intentionally |
| Evidence confusion | Missing `REPORT.md`, unclear verdict, no `NO_SHIP`, acceptance coverage confusion | Ask for session path and report summary; link report contract |
| Safety concern | apply, commit, push, publish, deploy, secrets, destructive changes | Confirm no automatic mutation occurred; request redacted logs and gate/ship summaries |
| Platform mismatch | Windows path, shell quoting, CRLF, file URL, temp directory behavior | Reproduce on the named OS/shell before changing docs or code |
| Product request | New agent, skill, pack, provider, workflow shortcut | Accept only if it strengthens verification evidence or first-run clarity |
| External run evidence | Real user run, transcript, report trust card, quote | Redact, verify permission, and preserve actual ship/gate/apply state |

## Minimum Evidence

An issue is actionable when it includes at least three of:

- NEKOWORK version or git commit
- install path, for example `npx @ps-neko/nekowork@alpha`
- OS and shell
- Node and npm versions
- exact command
- redacted `check --json`
- redacted `REPORT.md` summary
- public quote permission when evidence will be cited in docs or release notes
- session evidence file names, such as `verify-summary.json` or `ship-summary.json`
- expected behavior and actual behavior

If the issue is about ship/apply safety, require:

- `ship-summary.json` or `REPORT.md` summary
- gate status
- whether `apply` was requested
- target project git status after the run

## Severity

| Severity | Meaning | Examples |
|---|---|---|
| Critical | Safety invariant appears bypassed | automatic apply, publish, deploy, push, PR, or secret exposure |
| High | First-run or release path is blocked for a supported setup | `npx @alpha check` fails on supported Node/npm |
| Medium | Important docs or workflow confusion with a workaround | unclear report output, install docs missing platform note |
| Low | Enhancement or polish | copy edit, new example request, extra case-study suggestion |

Critical and high issues should keep `ship_ready=false` until reproduced or explicitly dismissed with evidence.

## Reproduction Path

Start with the smallest command that matches the report:

```bash
npx -y @ps-neko/nekowork@alpha check --json
```

For source checkout reports:

```bash
git status --short --branch
npm run lint
npm test
npm audit --audit-level=moderate
```

For target project reports:

```bash
node scripts/portability/simulate-port.js <target> --profile developer --json
node scripts/cli.js doctor --quick --project-root <target> --json
node scripts/cli.js report --session <session> --project-root <target> --stdout
node scripts/cli.js gate status --session <session> --project-root <target> --json
```

Use `--profile security --secure` when the report involves auth, secrets, deploy, financial, or environment configuration boundaries.

## Decision Outcomes

| Outcome | Use when | Required evidence |
|---|---|---|
| Docs-only fix | Behavior is correct but unclear | before/after docs diff, command output if relevant |
| Test-backed fix | Behavior is wrong or regressed | failing test or reproduced command, passing test after fix |
| Case study | Feedback shows a new risk class or platform behavior | target commit, target test result, NEKOWORK run summary |
| External evidence | Feedback shows a real public user run | redacted transcript, report trust card, final state, quote permission |
| Release blocker | Public alpha install or safety invariant is broken | failed `@alpha` smoke or invariant evidence |
| Not planned | Request weakens safety model or expands catalog without evidence value | explanation tied to product invariants |

## Labels

Recommended labels:

- `alpha-feedback`
- `external-run`
- `bug`
- `needs-repro`
- `needs-evidence`
- `docs`
- `release-blocker`
- `safety`
- `platform-windows`
- `platform-macos`
- `platform-linux`

If labels do not exist yet, use the same words in a maintainer comment.

## Maintainer Response Template

```markdown
Thanks for the report. I am triaging this as `<class>` / `<severity>`.

Evidence received:
- Version:
- Install path:
- OS/shell:
- Command:
- doctor/report evidence:

Next step:
- reproduce with:
- expected gate:
- ship/apply status should remain:
```

## Alpha Gate

Do not publish a new alpha for feedback-only changes until:

- `@alpha` smoke remains green
- new feedback docs or templates are covered by tests
- any release-blocker feedback is closed or documented as unresolved
- changelog entries match the intended alpha contents

## Alpha.10 Evidence Log

Tracks Beta Graduation Criteria #3 (external alpha feedback, 5+ entries) and #4 (seven consecutive smoke green days).

### Maintainer Smoke

| Date (UTC) | Source | Result | Notes |
|---|---|---|---|
| 2026-05-14 | maintainer (cafe_reo) | 5 PASS · 2 WARN · 0 FAIL | First post-publish smoke. Fresh temp directory, `npx -y @ps-neko/nekowork@alpha check`. Both WARNs expected: `git worktree` (temp dir is not a git repo), `gemini cli` (non-interactive auth check). Node 24.14.1. Package metadata reported `0.1.0-alpha.10`. |

### External Reports

_(empty — awaiting first external `check --json` or `REPORT.md` submission)_

Each entry must include the minimum evidence listed in §Minimum Evidence above. Redact secrets, tokens, and private paths before adding rows.

### Beta Graduation Burndown

| Criterion | Target | Current |
|---|---|---|
| #3 External alpha feedback | 5+ unique reporters, no blocking issue open | 0/5 |
| #4 Seven consecutive smoke days | 7 days of green `@alpha` smoke | 1/7 (2026-05-14 OK) |
| #6 Audit hygiene | `nekowork audit` reports zero moderate+ within last 7 days | run pending |
