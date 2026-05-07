# External Project Example

This walkthrough shows the current repository-based NEKOWORK integration path against a tiny external project.

The demo is intentionally mock-first. It does not call Claude, Codex, Gemini, or paid APIs.

## One-Command Demo

From the NEKOWORK checkout:

```bash
npm run demo:external
```

Expected shape:

```text
NEKOWORK external project demo
target : <temp-dir>
profile: developer

git    : initialized
preflight ... OK
install apply ... OK
doctor ... OK
plan smoke ... OK

Demo completed.
Inspect target: <temp-dir>
```

To remove the generated target after a successful run:

```bash
npm run demo:external -- --cleanup
```

To run against a specific folder:

```bash
npm run demo:external -- --target C:/path/to/demo-target --force
```

`--force` allows the demo to write into a non-empty target. Use an empty or disposable folder when trying the path for the first time.

## Manual Equivalent

Create a small target project:

```bash
mkdir demo-target
cd demo-target
git init
mkdir src
echo "console.log('hello NEKOWORK')" > src/index.js
```

Then run NEKOWORK from its checkout:

```bash
cd REPO_ROOT
node scripts/portability/simulate-port.js C:/path/to/demo-target --profile developer --verbose
node scripts/install-apply.js --profile developer --project-root C:/path/to/demo-target
node scripts/cli.js doctor --project-root C:/path/to/demo-target --quick
node scripts/cli.js plan "external project smoke" --project-root C:/path/to/demo-target --session external-smoke
```

Expected target outputs:

```text
demo-target/
  .harness/install-state.json
  .harness/state/sessions/external-smoke/handoffs/02-plan.json
  .claude/CLAUDE.md
  .codex/config.toml
  .cursor/hooks.json
  .gemini/GEMINI.md
  .opencode/config.json
```

## What This Proves

- NEKOWORK can stay outside the target project as a tool root.
- Generated harness surfaces are written into the target project.
- Session state is written under the target project's `.harness/`.
- The default planning flow works without live provider calls.

## What This Does Not Prove

- Public npm installation. The package metadata is ready, but publish execution still requires npm owner auth.
- Live provider execution. Run live provider smoke checks separately after local CLI login.
- A production rollout. Pin a release tag or submodule commit before using the tool in a shared workflow.
