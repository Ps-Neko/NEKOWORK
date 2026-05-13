# Bounded Autonomy

NEKOWORK can plan, build, verify, and repair before the apply boundary, but it never applies, commits, pushes, publishes, or deploys without explicit human action.

Autonomy is bounded by the apply boundary:

```text
route -> build -> verify -> repair loop -> report -> Human Gate / explicit apply
```

`auto` can plan, build, verify, and repair fixable findings before apply. It never commits, pushes, publishes, deploys, opens a PR, or applies a diff.

## Command

```bash
nekowork auto "fix failing tests safely"
nekowork auto "implement OAuth login" --level cautious
nekowork auto "prepare release readiness" --level normal --mode release
nekowork auto "large cleanup" --level aggressive --budget 5
nekowork auto "refactor auth parser safely" --parallel-candidates 2
```

Preview without creating a session:

```bash
nekowork auto "change OAuth token validation" --dry-run --json
```

## Levels

| Level | Repair Budget | Use when |
|---|---:|---|
| `cautious` | 1 round, no repair loop | the human wants one verified attempt and a report |
| `normal` | up to 3 rounds | fixable findings can be repaired before report |
| `aggressive` | up to 5 rounds | larger work can iterate more, but still stops before apply |

All levels preserve the same hard boundary:

- no automatic `apply`
- no automatic commit, push, publish, deploy, or PR creation
- multi-worker thinking stays read-only
- one executor owns project-file mutation per work round
- Codex verification remains required before ship/apply
- Human Gate cannot be bypassed

## Repair Policy

`auto` repeats the safe build loop only when the prior round is fixable:

| Result | Auto behavior |
|---|---|
| `ship_ready` | stop and write report |
| `no_ship` with fixable findings | repair until the level budget is exhausted |
| `human_gate` | stop immediately |
| unknown or non-fixable state | stop and write report |

The output is `auto-summary.json` plus the normal session evidence:

```text
build-intelligence.json
build-plan.json
parallel-candidates.json
candidate-verification.json
candidate-arbiter.json
canonical-candidate.json
canonical-verify-summary.json
acceptance-criteria.json
build-summary.json
run-summary.json
verify-summary.json
ship-summary.json
REPORT.md
```

## Apply Boundary

`auto` deliberately rejects `--apply`.

After `auto` finishes, the human should inspect:

```bash
nekowork report --session <id>
nekowork gate status --session <id>
```

Only after verified `SHIP_READY` evidence and clear gates should the human choose an explicit apply command:

```bash
nekowork apply --session <id>
```

This is the product rule:

```text
Autonomous until apply.
Verified before ship.
Human-controlled at the boundary.
```
