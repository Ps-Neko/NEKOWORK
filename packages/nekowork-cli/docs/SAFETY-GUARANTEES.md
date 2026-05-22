# Safety Guarantees

NEKOWORK is designed to make AI coding work auditable before it reaches a repository.

## Will Not

NEKOWORK will not:

- commit without an explicit user command
- push without an explicit user command
- publish packages
- deploy infrastructure
- apply diffs unless verified ship-ready evidence exists
- use API keys on the default mock path
- require API keys for the delegated local CLI path

`apply` is intentionally separate from `run`. A normal `run` creates evidence and a ship/no-ship decision; it does not change the target project unless `--apply` is explicitly requested and the safety checks pass.

## Apply Conditions

`apply` requires:

- a live-work diff captured for the selected session
- `SHIP_READY` evidence from the ship step
- no newer `NO_SHIP` marker
- no unresolved `HUMAN_GATE`
- a clean target worktree unless `--allow-dirty` is explicit
- a current session id chosen by the user

These conditions are meant to keep the final write step inspectable and reversible through normal git workflows.

## Writes NEKOWORK May Create

NEKOWORK may write local evidence and generated harness files:

- `.harness/state/sessions/<session>/`
- handoff markdown and JSON summaries
- `REPORT.md` when `report` is requested
- generated NEKOWORK tool surfaces during `init` / `install --apply`
- gate markers such as `HUMAN_GATE`, `HUMAN_APPROVED`, and `NO_SHIP`

Those files are local project artifacts. They are not automatically committed or pushed.

## Auth Model

The default path uses mock providers and does not call Claude, Codex, Gemini, OpenAI, or paid APIs.

When `--live` is used, NEKOWORK delegates to local CLI auth:

- Claude work uses the local `claude` login
- Codex verification uses the local `codex` login
- Gemini checks use the local Gemini CLI when requested

This keeps API keys out of the default setup and matches a local-first workflow.
