# Advanced Features

The public alpha path focuses on `doctor`, `plan`, `review`, and install/apply. This page keeps the larger runtime surface discoverable without crowding the first-run docs.

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

Outputs:

- `.harness/state/sessions/<id>/team-lite.json`
- `.harness/state/sessions/<id>/monitor.json`
- `.harness/state/sessions/<id>/heartbeat.jsonl`
- `.harness/state/sessions/<id>/handoffs/`

## ralph

`ralph` is an explicit opt-in loop that repeats until PRD acceptance criteria pass or a human gate is hit.

```bash
node scripts/cli.js ralph "finish the acceptance criteria" --max-iter 5 --no-ship
```

Use it only when repeated local iteration is desired. It is not part of the basic quickstart.

## instincts

Instincts are project-local learning records. Promotion is intentionally manual.

```bash
node scripts/cli.js instincts list
node scripts/cli.js instincts ready --blocked
node scripts/cli.js instincts promote <id>
```

Promotion requires confidence `1.0`; automatic promotion without human confirmation is outside the 0.0.3 release scope.

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

The Node CLI remains the primary 0.0.3 user path.

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
