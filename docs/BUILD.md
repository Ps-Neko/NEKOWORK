# Build Command

`build` is NEKOWORK's productivity-first entrypoint. Start here when you want one command to move from a task to verified ship readiness:

```bash
nekowork build "implement this safely"
nekowork report --session latest
nekowork gate status --session latest
```

Drop down to `ask`, `plan`, `team`, `work`, `verify`, `ship`, and `apply` only when you need phase-level control.

Use `auto` when you want bounded autonomy before apply:

```bash
nekowork auto "fix failing tests safely" --level normal
```

`auto` wraps `build`, repeats fixable no-ship work within a level budget, writes `auto-summary.json`, generates `REPORT.md`, and stops before apply.

Preview the planned mode without running workers:

```bash
nekowork build "implement this safely" --dry-run
nekowork build "implement this safely" --explain
```

`--dry-run` does not create a session, call providers, write handoffs, or mutate the target project. It only resolves the build mode, profile, stages, workers, task intelligence, and safety invariants.

`--explain` runs the build and then prints the selected mode rationale plus the evidence files written in the session.

By default, `build` uses `--mode auto`. Auto mode classifies the task, chooses one of the safe build presets, selects any needed read-only workers, creates acceptance criteria, and records a mini plan for the single executor.

## Mode Contract

| Mode | Safety Rank | Purpose | Internal Behavior | Apply |
|---|---:|---|---|---|
| `auto` | n/a | Task-aware routing | classifies intent, selects `fast`, `safe`, `team`, `tdd`, or `release`, and records build intelligence | Explicit only |
| `fast` | 0 | Quick implementation | `run = work -> verify -> ship` with quality profile | Explicit only |
| `team` | 1 | Parallel thinking before work | read-only team handoffs, then one executor through `run` | Explicit only |
| `tdd` | 1 | Test-first work | quality profile with strict acceptance and evidence checks | Explicit only |
| `release` | 2 | Release readiness | quality profile with ship/report evidence before apply | Explicit only |
| `safe` | 3 | Risky or sensitive changes | security profile, strict quality, Codex challenge, Human Gate policy | Explicit only |

The safety ranks are defined in `manifests/build-modes.json` and validated by `schemas/build-modes.schema.json`. Runtime override checks read the manifest-backed ranks, so docs, tests, and policy stay aligned.

## Auto Mode Routing

`auto` is the default:

```bash
nekowork build "add OAuth login" --dry-run --json
```

Example routing:

| Task signal | Selected mode | Extra behavior |
|---|---|---|
| docs, README, typo | `fast` | no read-only team phase |
| auth, token, secret, payment, financial, database, CI/deploy risk | `safe` | security profile, strict quality, Codex challenge, selected security/test workers |
| UI, dashboard, product scope, accessibility | `team` | planner/product/design/security/test read-only handoffs before work |
| tests, coverage, regression, TDD | `tdd` | strict acceptance evidence and test worker perspective |
| release notes, changelog, npm package, versioning | `release` | readiness-focused evidence and report path |

Risky explicit downgrades are blocked by default:

```bash
nekowork build "change OAuth token validation" --mode fast
# blocked: recommended mode is safe

nekowork build "prepare npm package publish release notes" --mode fast
# blocked: recommended mode is release
```

Use `--force-mode` only when the human intentionally accepts a lower-safety override:

```bash
nekowork build "change OAuth token validation" --mode fast --force-mode --dry-run
```

## Dry-run Preview

Dry-run output shows the same preset resolution used by real builds:

```text
=== build dry-run ===
  mode       : safe (auto)
  profile    : security
  task type  : security-sensitive
  risk       : high (security)
  apply      : not requested

Stages:
  - team: run (planner,security,test)
  - work: run
  - verify: run (with challenge)
  - ship: run
  - apply: skip
```

For automation, add `--json` to read the preview contract:

```bash
nekowork build "change auth token validation" --mode safe --dry-run --json
```

## Report Integration

Auto mode writes these evidence files:

- `build-intelligence.json`
- `build-plan.json`
- `acceptance-criteria.json`
- `build-summary.json`

`nekowork report --session <id>` includes a `Build Intelligence` section with requested mode, selected mode, task type, risk tags, workers, and the routing explanation.

## Safety Invariants

`build` is a wrapper, not a bypass:

```text
optional read-only team thinking
  -> single executor work
  -> Codex verification
  -> ship/no-ship readiness
  -> report
  -> explicit apply only when requested
```

It preserves the same core rules as the decomposed workflow:

- no automatic commit, push, publish, deploy, or PR creation
- no implicit `apply`
- multi-worker phases are read-only
- one executor owns project-file mutation
- Codex verification remains mandatory before ship/apply
- Human Gate remains non-bypassable for risky work

## Examples

Fast path:

```bash
nekowork build "add a small validated change" --dry-run
nekowork build "add a small validated change" --session work-1
nekowork report --session work-1
```

Security-sensitive path:

```bash
nekowork build "change auth token validation" --mode safe --session auth-1
nekowork report --session auth-1
nekowork gate status --session auth-1
```

Team-thinking path:

```bash
nekowork build "scope and implement dashboard filters" --mode team --session dashboard-1
nekowork report --session dashboard-1
```

Use `--apply` only when live work captured a verified `SHIP_READY` diff and you intentionally want to mutate the target project.
