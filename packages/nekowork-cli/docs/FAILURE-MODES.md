# Failure Modes

NEKOWORK should fail in ways that leave evidence behind and avoid surprise writes.

## Health Check Warnings

`check` is a quick alias for `doctor --quick`.

Typical warnings include:

- target directory is not a git repository
- provider CLI is missing
- optional live auth was not checked
- package metadata is present but not release-ready

Warnings are meant to tell the user what would matter for live work. They do not mutate the project.

## No-Ship

`ship` writes `NO_SHIP` when the session has unresolved quality, security, or acceptance risk.

Recovery path:

```bash
node packages/nekowork-cli/scripts/cli.js report --session <id>
node packages/nekowork-cli/scripts/cli.js run "fix the reported blocker" --session <new-id>
node packages/nekowork-cli/scripts/cli.js gate status --session <new-id>
```

`apply` refuses a no-ship session unless a maintainer intentionally changes the evidence flow.

## Human Gate

`HUMAN_GATE` means the tool found risk that needs a person before apply.

The user can:

```bash
node packages/nekowork-cli/scripts/cli.js gate status --session <id>
node packages/nekowork-cli/scripts/cli.js gate approve --session <id> --reason "reviewed risk"
node packages/nekowork-cli/scripts/cli.js gate block --session <id> --reason "needs more tests"
```

Approval records evidence. Blocking keeps the session from shipping.

## Apply Refusal

`apply` can refuse when:

- there is no live-work diff
- `SHIP_READY` is missing
- a newer `NO_SHIP` exists
- `HUMAN_GATE` is unresolved
- the target worktree is dirty

Recovery path:

```bash
git status -sb
node packages/nekowork-cli/scripts/cli.js report --session <id>
node packages/nekowork-cli/scripts/cli.js gate status --session <id>
```

Then either fix the blocker, approve/block the gate, or rerun the session.

## Stale Generated Files

When catalog, tests, or generated docs change, codemap or generated-output checks may fail.

Recovery path:

```bash
node scripts/build-codemaps.js
npm test
```

The generated diff should be reviewed like any other project change.

## Provider Auth Problems

Default mock mode does not require provider auth.

Live mode can fail if local CLI auth is missing or expired. In that case, log in through the provider CLI, then rerun the same command. NEKOWORK does not need long-lived API-key fallback for the normal delegated CLI path.

## npm / npx Problems

If `npx -y @ps-neko/nekowork@alpha check` fails, capture:

- OS and shell
- Node and npm versions
- exact command
- redacted output

Then open an alpha feedback issue with the triage template.
