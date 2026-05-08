# Advanced Features

The public alpha path focuses on `doctor`, `build`, `report`, `gate`, and the decomposed `ask`, `plan`, `team`, `work`, `verify`, `ship`, `apply`, `run`, `review`, `review-cycle`, and install/apply surfaces. This page keeps the larger runtime surface discoverable without crowding the first-run docs.

## team

`team` is the public read-only team handoff command:

```bash
node scripts/cli.js team "split and review this change" --workers planner,research,security,test --no-write --session team-smoke
```

Rules:

- Workers create handoffs only.
- No worker runs the `implement` stage.
- All live Claude calls run in non-interactive handoff mode and are protected by the git mutation guard.
- The next mutating step must be a single executor work/review cycle.

Outputs:

- `.harness/state/sessions/<id>/team.json`
- `.harness/state/sessions/<id>/team-summary.json`
- `.harness/state/sessions/<id>/handoffs/`

## work

`work` is the public single-executor implementation phase:

```bash
node scripts/cli.js work "implement the accepted plan" --single-executor --session work-smoke
```

Rules:

- Only the `executor` agent runs.
- Acceptance criteria are required as a session artifact and are written to `acceptance-criteria.json`.
- Codex review does not run in this command.
- Ship does not run in this command.
- Mock mode writes an implement handoff only.
- Live mode uses an isolated git worktree and persists a diff under the session.
- The target project is not mutated directly by `work`.

Outputs:

- `.harness/state/sessions/<id>/work-summary.json`
- `.harness/state/sessions/<id>/acceptance-criteria.json`
- `.harness/state/sessions/<id>/handoffs/03-implement.md`
- `.harness/state/sessions/<id>/handoffs/03-implement.json`
- `.harness/state/sessions/<id>/diffs/` when live execution produces a diff

## verify

`verify` is the public Codex-only verification phase:

```bash
node scripts/cli.js verify "verify the accepted work" --session work-smoke
node scripts/cli.js verify "verify sensitive auth work" --session work-smoke --secure
```

Rules:

- A prior `work` handoff in the same session is required.
- Codex review always runs.
- Codex challenge runs when `--secure` is set or sensitive task/file names are detected.
- The shared risk classifier decides challenge and Human Gate policy.
- Implement does not run.
- Ship does not run.
- Critical or blocking findings write `HUMAN_GATE`.

Outputs:

- `.harness/state/sessions/<id>/verify-summary.json`
- `.harness/state/sessions/<id>/handoffs/05-codex-review.md`
- `.harness/state/sessions/<id>/handoffs/06-codex-challenge.md` when secure/challenge is active
- `.harness/state/sessions/<id>/HUMAN_GATE` when Codex blocks or reports critical findings

## gate

`gate` is the explicit human decision phase:

```bash
node scripts/cli.js gate status --session work-smoke
node scripts/cli.js gate approve --session work-smoke --reason "Reviewed and accepted the risk"
node scripts/cli.js gate block --session work-smoke --reason "Release risk rejected"
```

Rules:

- `status` inspects `HUMAN_GATE`, `GATE_APPROVED`, and `GATE_BLOCKED`.
- `approve` requires an open `HUMAN_GATE` and a reason.
- `block` requires an existing session and a reason.
- Approval does not delete `HUMAN_GATE`; it records `GATE_APPROVED` for audit.
- An explicit block records `GATE_BLOCKED` and keeps `ship` stopped.
- The target project is not mutated by this command.

Outputs:

- `.harness/state/sessions/<id>/GATE_APPROVED` when approved
- `.harness/state/sessions/<id>/GATE_BLOCKED` when blocked
- `.harness/state/sessions/<id>/gate-summary.json`
- `.harness/state/sessions/<id>/gate-events.jsonl`

## ship

`ship` is the public ship/no-ship readiness phase:

```bash
node scripts/cli.js ship "prepare ship readiness" --require-clean-gates --session work-smoke
```

Rules:

- A prior `work` handoff in the same session is required.
- A prior `verify`/`codex-review` handoff in the same session is required.
- Existing `HUMAN_GATE` blocks ship unless `gate approve` recorded a later approval.
- Blocking or critical Codex findings write or preserve `HUMAN_GATE`.
- Financial and deploy-sensitive risk policy is rechecked before readiness.
- `approve_with_fixes` creates a no-ship handoff rather than a ready marker.
- The target project is not mutated by this command.

Outputs:

- `.harness/state/sessions/<id>/ship-summary.json`
- `.harness/state/sessions/<id>/handoffs/07-ship.md` when not human-gated
- `.harness/state/sessions/<id>/SHIP_READY` when Codex verification is fully approved
- `.harness/state/sessions/<id>/NO_SHIP` when fixable findings remain

## apply

`apply` is the explicit project-mutation phase for live work diffs:

```bash
node scripts/cli.js apply --session work-smoke
node scripts/cli.js apply --session work-smoke --allow-dirty
```

Rules:

- A prior `work` handoff in the same session is required.
- A prior `verify`/`codex-review` handoff in the same session is required.
- `SHIP_READY` is required.
- `NO_SHIP`, open `HUMAN_GATE`, or `GATE_BLOCKED` stops apply.
- A captured diff from `work --live` is required.
- The project must be a git worktree.
- The project worktree must be clean, excluding `.harness/` session state, unless `--allow-dirty` is used.
- `APPLIED_DIFF` makes apply idempotent unless `--force` is used.

Outputs:

- `.harness/state/sessions/<id>/APPLIED_DIFF`
- `.harness/state/sessions/<id>/apply-summary.json`

## run

`run` is the public convenience wrapper for the decomposed pipeline:

```bash
node scripts/cli.js run "implement and verify this change" --session run-smoke
node scripts/cli.js run "sensitive auth change" --session run-smoke --secure
node scripts/cli.js run "live change" --session run-smoke --live --apply
```

Rules:

- Runs `work -> verify -> ship`.
- Does not apply by default.
- `--secure` is forwarded to `verify`.
- `--live` is forwarded to `work`, `verify`, and `ship`.
- `--apply` runs `apply` only when `ship` produced `SHIP_READY`.
- Open gates stop the run with exit code 3.
- `NO_SHIP` skips apply and leaves a no-ship readiness handoff.

Policy:

- `run` is the short safe wrapper for new users.
- `run` does not call `plan` in the current alpha line.
- `plan` is recommended before `work` for larger changes.
- `work` still records `acceptance-criteria.json`, so `run` preserves success criteria evidence.
- `apply` is always explicit; use `run --apply` only after live work can produce a captured diff.

Outputs:

- `.harness/state/sessions/<id>/run-summary.json`
- all normal `work`, `verify`, `ship`, and optional `apply` outputs

## build

`build` is the public one-command builder wrapper:

```bash
node scripts/cli.js build "implement this safely" --dry-run
node scripts/cli.js build "implement this safely" --explain --session build-smoke
node scripts/cli.js build "auth-sensitive change" --mode safe --session auth-smoke
node scripts/cli.js build "scope with team thinking" --mode team --session team-smoke
```

Rules:

- `auto` is the default and routes the task to `fast`, `safe`, `team`, `tdd`, or `release`.
- `fast` runs the compact safe path through `run`.
- `safe` uses the security profile, strict quality, and Codex challenge.
- `team` creates read-only team handoffs before the single executor runs.
- `tdd` uses strict quality and acceptance evidence.
- `release` focuses on ship/readiness and report evidence.
- `--dry-run` previews auto routing, preset resolution, stages, workers, and safety invariants without writing session state.
- `--explain` prints routing rationale and evidence files after the build.
- `--force-mode` is required when a risky task is manually forced into a lower-safety mode than the risk-aware recommendation.
- Build mode safety ranks are defined in `manifests/build-modes.json` and validated with the manifest schemas, so mode policy changes are reviewable outside the CLI code.
- `apply` is never implicit; use `--apply` only for verified live-work diffs.

Outputs:

- `.harness/state/sessions/<id>/build-summary.json`
- all normal `run`, `work`, `verify`, `ship`, and optional `apply` outputs

## report

`report` turns existing session evidence into a readable inspect-only report:

```bash
node scripts/cli.js report --session run-smoke
node scripts/cli.js report --session latest
node scripts/cli.js report --session run-smoke --stdout
node scripts/cli.js report --session run-smoke --output docs/session-report.md
```

Rules:

- Reads summaries, markers, acceptance criteria, and handoffs from `.harness/state/sessions/<id>/`.
- Writes `REPORT.md` and `report-summary.json` by default.
- Does not call providers, run git commands, apply diffs, or mutate target project files.
- Can run after `ask`, `work`, `verify`, `ship`, `run`, `build`, or `apply`.

Outputs:

- `.harness/state/sessions/<id>/REPORT.md`
- `.harness/state/sessions/<id>/report-summary.json`

## review-cycle

`review-cycle` is the explicit compatibility alias for the legacy full workflow:

```bash
node scripts/cli.js review-cycle "legacy full-cycle smoke" --no-ship
```

Rules:

- It is equivalent to `review` in the current alpha line.
- It keeps the old `ideate -> plan -> implement -> self-review -> codex-review -> codex-challenge -> ship` behavior discoverable while new automation migrates to `run` or the decomposed commands.
- It writes `review-summary.json` with `mode: legacy-full-review-cycle`.
- It may use legacy live-review behavior, so new controlled project mutation should prefer `work --live -> verify -> ship -> apply`.

## team-lite

`team-lite` is a lightweight staged team pipeline inspired by OMC concepts:

```bash
node scripts/cli.js team-lite "split and verify this change" --session team-smoke
```

Stages:

- `team-plan`
- `team-prd`
- `team-exec`
- `team-verify`
- `team-fix`

Product rule:

- Team stages produce handoffs and coordination state.
- Multi-worker phases are read-only by default.
- Project file mutation belongs to a single executor phase in the main work/review path.
- Codex verification and human gate policy still apply after team output is used.
- `team-lite.json` records `mode: advanced-team-lite-handoff`, `mutation: read-only-handoffs`, and `target_project_mutated: false`.

Outputs:

- `.harness/state/sessions/<id>/team-lite.json`
- `.harness/state/sessions/<id>/monitor.json`
- `.harness/state/sessions/<id>/heartbeat.jsonl`
- `.harness/state/sessions/<id>/handoffs/`

## ralph

`ralph` is an explicit opt-in loop that repeats until PRD acceptance criteria pass, a human gate is hit, a cost cap stops it, or `--max-iter` is reached.

```bash
node scripts/cli.js ralph "finish the acceptance criteria" --max-iter 5
node scripts/cli.js ralph "finish using the decomposed flow" --engine run --max-iter 5
```

Rules:

- The default engine is `review`, preserving the legacy full review-cycle behavior.
- `--engine run` repeats the decomposed `run` wrapper instead: `work -> verify -> ship`.
- Ralph never applies by default; even with the run engine, project mutation still belongs to an explicit `apply` path outside the loop.
- Each iteration writes a child session such as `<ralph-session>-i1`.
- The parent session writes `ralph-summary.json` with the selected engine and iteration sessions.

Use it only when repeated local iteration is desired. It is not part of the basic quickstart.

## wait

`wait` is the persistent wakeup daemon for explicit active sessions:

```bash
node scripts/cli.js wait status
node scripts/cli.js wait start
node scripts/cli.js wait stop
```

Rules:

- The persistent-mode hook writes `wakeup.json` only when a session has an `active` file.
- The daemon parses `active` and resumes only supported modes: `ralph`, `run`, and `review-cycle`.
- Ralph active sessions may resume with either `engine: review` or `engine: run`.
- `HUMAN_GATE` stops resume and writes `wait-summary.json` instead.
- Failed resume attempts keep `wakeup.json` and add a short backoff.
- Successful or blocked decisions append `wait-events.jsonl`.

This is still an advanced opt-in surface. It does not bypass gates and does not apply diffs by itself.

## instincts

Instincts are project-local learning records. Promotion is intentionally manual.

```bash
node scripts/cli.js instincts list
node scripts/cli.js instincts ready --blocked
node scripts/cli.js instincts promote <id>
```

Promotion requires confidence `1.0`; automatic promotion without human confirmation is outside the current alpha release scope.

## Cost Tracking

Cost records are appended to `.harness/costs.jsonl` when live runners report token usage.

```bash
node scripts/cli.js costs --since=7d
node scripts/cli.js costs --since=7d --rows
node scripts/cli.js costs --since=7d --json
```

These are estimates, not billing records.

## Rust Runtime

The Rust runtime under `runtime/` is a supervisor and IPC experiment for persistent operation.

Verify it with:

```bash
npm run verify:runtime
```

The Node CLI remains the primary alpha user path.

## Full Builder Surface

The install/apply flow builds the configured harness outputs. You can also run builders directly:

```bash
node scripts/build-claude.js
node scripts/build-codex.js
node scripts/build-cursor.js
node scripts/build-gemini.js
node scripts/build-opencode.js
```

Use `HARNESS_PROJECT_ROOT=<target>` to project outputs into another repository while reading catalog inputs from the NEKOWORK checkout.
