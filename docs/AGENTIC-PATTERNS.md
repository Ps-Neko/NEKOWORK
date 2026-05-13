# Agentic Harness Patterns

NEKOWORK implements the 12 practical agentic harness patterns as a safety-first development runtime. The patterns are not a checklist of features to maximize. They are a design language for splitting work, checking work, approving risk, and improving the loop.

NEKOWORK's boundary remains fixed:

```text
Autonomous until apply.
Verified before ship.
Human-controlled at the boundary.
```

## Selection Rule

Choose patterns by:

- risk: higher risk needs verification, Human Gate, and tool gates
- repetition: repeated work benefits from memory and evolution loops
- complexity: complex work benefits from routing, team handoffs, and pipelines

## Pattern Coverage

| # | Pattern | NEKOWORK Surface | Status | Notes |
|---:|---|---|---|---|
| 1 | Single Agent | `work` | Strong | One executor produces the candidate implementation. |
| 2 | Plan-Execute | `ask`, `plan`, Build Intelligence mini plan | Strong | Larger work can start with question gate and planning; `build` records acceptance criteria and a mini plan. |
| 3 | Generate-Review | `work -> verify`, Codex review/challenge | Strong | Implementation and independent verification are separate phases. |
| 4 | Router | Build Intelligence, risk classifier | Strong | `build --mode auto` routes tasks to `fast`, `safe`, `team`, `tdd`, or `release`. |
| 5 | Expert Team | `team` read-only handoffs | Strong | Planner, research, product/design, security, test, and Codex perspectives can contribute before mutation. |
| 6 | Supervisor | `build`, `auto`, `run` | Strong | Orchestrators coordinate routing, work, verification, ship/readiness, and report output. |
| 7 | Parallel Processing | `team`; `auto --parallel-candidates N` preview | Partial | Read-only team perspectives exist. Isolated candidate evidence, candidate verification, and arbiter selection exist; ship-ready final diff promotion is still planned. |
| 8 | Sequential Pipeline | `ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply` | Strong | The advanced path is an auditable pipeline with explicit state artifacts. |
| 9 | Human Approval | `gate` | Strong | Human Gate records approve/block decisions and stops risky work before apply. |
| 10 | Memory Loop | `instincts`, `wait`, `ralph` | Partial | Patterns are recorded and can become skill candidates, but promotion remains manual. |
| 11 | Tool Gate | auth guard, git mutation guard, hooks, `apply` | Strong | Provider auth, shell risk, config edits, git mutation, and final diff apply are gated. |
| 12 | Evolution Loop | `ralph`, feedback triage, release gates, instincts | Partial | NEKOWORK supports bounded iteration and learning records without automatic unsafe promotion. |

## What Is Already Strong

NEKOWORK is strongest at the patterns that make AI code changes auditable:

- router: task risk becomes a visible mode/profile decision
- generate-review: executor and verifier are separate roles
- sequential pipeline: every phase leaves session evidence
- human approval: risky decisions stop at Human Gate
- tool gate: apply, provider auth, shell commands, and config paths are constrained

This is why the product thesis is not "more agents." The thesis is:

```text
AI can build quickly, but changes must prove themselves before apply.
```

## Known Gaps

### Parallel Processing

Current team mode is read-only. It gives multiple perspectives. `auto --parallel-candidates N` now records isolated candidate evidence, verifies candidates, and writes arbiter/canonical-candidate evidence, but it does not yet promote candidate patches into a ship-ready final diff.

The full `auto --parallel-candidates N` pattern should work like this:

```text
planner
  -> isolated candidate workers (preview records this evidence)
  -> candidate verification (preview records this evidence)
  -> arbiter summary (preview records selected candidate evidence)
  -> one canonical final diff (planned)
  -> Codex verification
  -> report / Human Gate / ship
  -> explicit apply only
```

Rules:

- no concurrent writes to the same target worktree
- candidate patches are evidence, not ship-ready output
- only one canonical final diff may become the ship candidate
- Codex verification still runs on the final diff
- Human Gate and explicit apply remain non-bypassable

### Evolution Loop

NEKOWORK records repeated patterns through instincts and can repeat bounded work through `ralph`, but it intentionally avoids automatic promotion.

The correct shape is:

```text
automatic observation
manual promotion
explicit adoption
```

This keeps improvement possible without letting stale or unsafe memory silently change future behavior.

## Product Interpretation

The 12 patterns explain why NEKOWORK should feel different from a plain agent pack:

```text
single agent       -> one executor writes
expert team        -> many agents think
router             -> risk selects the path
generate-review    -> Codex checks the work
human approval     -> risky boundaries stop
tool gate          -> apply stays explicit
evolution loop     -> lessons become reviewed candidates
```

The next "wow" feature is not a larger catalog. It is isolated parallel candidate writers that preserve the same final boundary:

```text
Parallel until final diff.
Verified before ship.
Human-controlled at apply.
```
