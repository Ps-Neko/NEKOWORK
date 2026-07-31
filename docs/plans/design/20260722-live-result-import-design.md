# Live Result Import Design

## Objective

Allow an operator to load the two standard NEKOWORK outputs, `REPORT.md` and
`.nekowork/decision.json`, into the visualizer and understand the result without
creating or uploading any data to a server.

## User Flow

1. The operator opens the visualizer and selects the two local files.
2. The browser validates and reads the files locally.
3. The visualizer shows the current decision card, verdict, risk level, reason,
   and the report text.
4. Information unavailable in the standard output is labelled as unavailable,
   not inferred from the report.

## Scope

- The importer accepts exactly one JSON decision file and one Markdown report.
- Files are processed only in browser memory; no network request or persistence.
- Invalid files receive a clear, actionable error message.
- Existing fixtures and the visualizer query parameter continue working.

## Boundaries

- Always: preserve deterministic verdict semantics and Human Gate messaging.
- Ask first: upload data, add a backend, alter CLI file formats, or add dependencies.
- Never: treat a loaded file as permission to apply, merge, push, or deploy.

## Commands

- Type check: `pnpm --filter @ps-neko/visualizer typecheck`
- Build: `pnpm --filter @ps-neko/visualizer build`
- Browser tests: `pnpm --filter @ps-neko/visualizer test`

## Tasks

### 1. Define a minimal imported-result model and parser

- Acceptance: reads the two files, validates required decision fields, and
  returns clear errors for a missing or malformed file.
- Verify: unit tests cover valid input and each failure case.
- Files: `src/import-result.ts`, a new focused unit test file.

### 2. Add an accessible local-file import control

- Acceptance: the page accepts both files, displays loading/errors, and never
  sends their contents over the network.
- Verify: Playwright test selects files and observes the loaded verdict.
- Files: `src/main.ts`, `src/renderer.ts`, `src/styles.css`, `tests/a11y.test.ts`.

### 3. Render a reduced result view for standard outputs

- Acceptance: verdict, risk, reason, report, and unavailable detail states are
