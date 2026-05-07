# CLI Stages

The long-term NEKOWORK workflow is:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> apply
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
| `apply` | Apply a verified `SHIP_READY` live-work diff. | Controlled project mutation |

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
