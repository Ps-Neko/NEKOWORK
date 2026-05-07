# Demo Report

`report` is the public evidence summary command. It turns an existing session directory into a readable `REPORT.md` without calling providers, running git, applying diffs, or mutating target project files.

## Command

```bash
node scripts/cli.js run "implement, verify, and prepare ship readiness" --session demo-report
node scripts/cli.js report --session demo-report
```

For a target project:

```bash
node .harness-tool/scripts/cli.js report --session demo-report --project-root .
```

To print the report instead of writing `REPORT.md`:

```bash
node scripts/cli.js report --session demo-report --stdout
```

## Output

By default, `report` writes:

```text
.harness/state/sessions/<session>/REPORT.md
.harness/state/sessions/<session>/report-summary.json
```

`REPORT.md` includes:

- session status and verdict
- Human Gate, no-ship, ship-ready, and apply state
- profile and strict-quality state
- acceptance criteria coverage
- quality warnings
- handoff table
- evidence file list

## Example `REPORT.md`

This is the shape a reviewer should expect from a short quality-profile run:

```md
# NEKOWORK Report

- Session: `demo-report`
- Status: `no_ship`
- Verdict: `approve_with_fixes`
- Ship ready: `false`
- Applied: `false`
- Human gate: `required`
- Profile: `quality`
- Strict quality: `enabled`

## Acceptance

| Criterion | Status | Evidence |
|---|---|---|
| AC-001: implement requested behavior | covered | `work-summary.json` |
| AC-002: Codex independent verification | covered | `verify-summary.json` |
| AC-003: ship readiness decision | covered | `ship-summary.json` |
| AC-004: human gate state recorded | covered | `gate-summary.json` |
| AC-005: project mutation applied only when explicit | missing | no `APPLIED_DIFF` marker |

Coverage: `4/5`

## Quality Warnings

- Codex found fixable findings, so ship readiness is blocked.
- Apply was not requested and no verified live-work diff was applied.

## Evidence

- `acceptance-criteria.json`
- `work-summary.json`
- `verify-summary.json`
- `ship-summary.json`
- `gate-summary.json`
- `handoffs/03-implement.md`
- `handoffs/05-codex-review.md`
```

## Safety Contract

`report` is inspect-only:

- no provider calls
- no project source inspection
- no git mutation
- no diff apply
- no PR, release, publish, or deploy

Use it after `run`, `ship`, or `apply` when you want a compact artifact to share with a human reviewer.
