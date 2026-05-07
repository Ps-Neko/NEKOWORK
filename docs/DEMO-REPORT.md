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

## Safety Contract

`report` is inspect-only:

- no provider calls
- no project source inspection
- no git mutation
- no diff apply
- no PR, release, publish, or deploy

Use it after `run`, `ship`, or `apply` when you want a compact artifact to share with a human reviewer.
