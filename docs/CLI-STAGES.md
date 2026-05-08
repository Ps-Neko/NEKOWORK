# CLI Stages

The long-term NEKOWORK workflow is:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```

## Stage Contract

| Stage | Purpose | Mutation |
|---|---|---|
| `ask` | Clarify goal, scope, risk, and draft success criteria. | No project mutation |
| `plan` | Produce implementation plan and acceptance criteria. | No project mutation |
| `team` | Produce read-only handoffs from selected worker perspectives. | No project mutation |
| `work` | Run one executor against the accepted scope. | Isolated single-executor work |
| `verify` | Run Codex review, optional Codex challenge, and risk gate logic. | No project mutation |
| `gate` | Record human approval or block for an open gate. | No project mutation |
| `ship` | Produce ship/no-ship readiness markers and handoff. | No project mutation |
| `report` | Summarize session evidence into a readable report. | No project mutation |
| `apply` | Apply a verified `SHIP_READY` live-work diff. | Controlled project mutation |

## Beginner And Advanced Paths

Most users should start with this Beginner path:

```text
doctor -> build -> report -> gate status
```

`build` is the short safe wrapper for one-command use. It defaults to `auto`, which classifies task intent and chooses a mode preset over the same evidence loop. `fast`, `safe`, `team`, `tdd`, and `release` tune profile, strictness, Codex challenge, and read-only team thinking; none of them apply by default. Risky manual downgrades from the risk-aware recommendation require `--force-mode`.

Use bounded autonomy when the tool should continue before the apply boundary:

```text
doctor -> auto -> report -> gate status
```

`auto` wraps `build`, can repair fixable no-ship findings within `--level cautious|normal|aggressive` budgets, writes `auto-summary.json`, and still never applies automatically.

Advanced path:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```

Use the advanced path when the change needs a separate plan artifact, read-only team handoffs, explicit verification control, or a manual apply step.

Quality-sensitive runs can add profile policy:

```bash
harness ask "task" --profile quality
harness work "task" --profile quality --session <id>
harness verify "task" --profile quality --strict-quality --session <id>
```

`--strict-quality` turns missing evidence or acceptance coverage warnings into a fix-required verification verdict.

## Plan And Run Policy

For the current alpha line:

- `plan` is recommended before `work` for non-trivial changes.
- `run` does not call `plan`; it remains a compact wrapper around `work -> verify -> ship`.
- `build` does not bypass `run`; it selects a mode preset and then preserves `work -> verify -> ship`.
- `auto` does not bypass `build`; it repeats bounded `build` rounds only for fixable no-ship states and stops on Human Gate.
- `work` always ensures `acceptance-criteria.json`, using `prd.json` when available or a task-derived minimum otherwise.
- Future release lines may add `run --with-plan` or require an accepted plan artifact for higher-risk work.
- `apply` is always explicit. `run` applies only with `--apply`.
- `report` is inspect-only and can run after `ask`, `work`, `verify`, `ship`, `run`, `build`, `auto`, or `apply`.

## Explicit Safety Aliases

These flags are accepted as public intent markers:

```bash
harness team "task" --no-write
harness work "task" --single-executor
harness ship "task" --session <id> --require-clean-gates
```

They do not weaken behavior. They make the contract readable at the call site.

## Compatibility Window

Short term:

```text
review = legacy full review cycle
review-cycle = explicit legacy alias
verify = Codex-only verification
run = work -> verify -> ship, optional apply
```

Future transition:

```text
run/work = execution wrapper
review = verification-only
review-cycle = legacy full-cycle compatibility
```
