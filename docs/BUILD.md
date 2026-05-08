# Build Command

`build` is NEKOWORK's productivity-first entrypoint. Start here when you want one command to move from a task to verified ship readiness:

```bash
nekowork build "implement this safely" --mode fast
nekowork report --session latest
nekowork gate status --session latest
```

Drop down to `ask`, `plan`, `team`, `work`, `verify`, `ship`, and `apply` only when you need phase-level control.

Preview the planned mode without running workers:

```bash
nekowork build "implement this safely" --mode team --dry-run
```

`--dry-run` does not create a session, call providers, write handoffs, or mutate the target project. It only resolves the build mode, profile, stages, workers, and safety invariants.

## Mode Contract

| Mode | Purpose | Internal Behavior | Apply |
|---|---|---|---|
| `fast` | Quick implementation | `run = work -> verify -> ship` with quality profile | Explicit only |
| `safe` | Risky or sensitive changes | security profile, strict quality, Codex challenge, Human Gate policy | Explicit only |
| `team` | Parallel thinking before work | read-only team handoffs, then one executor through `run` | Explicit only |
| `tdd` | Test-first work | quality profile with strict acceptance and evidence checks | Explicit only |
| `release` | Release readiness | quality profile with ship/report evidence before apply | Explicit only |

## Dry-run Preview

Dry-run output shows the same preset resolution used by real builds:

```text
=== build dry-run ===
  mode       : team
  profile    : quality
  apply      : not requested

Stages:
  - team: run (planner,product,security,test)
  - work: run
  - verify: run
  - ship: run
  - apply: skip
```

For automation, add `--json` to read the preview contract:

```bash
nekowork build "change auth token validation" --mode safe --dry-run --json
```

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
nekowork build "add a small validated change" --mode fast --dry-run
nekowork build "add a small validated change" --mode fast --session work-1
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
