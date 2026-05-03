# Quickstart

This guide gets a new user from a clean checkout to the first NEKOWORK run.

## 1. Install From Source

HARNESS 0.0.3 is not published to npm yet. Use the repository path:

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
```

Verify the checkout:

```bash
node scripts/cli.js doctor --quick
```

`doctor --quick` checks Node.js, package metadata, git state, API key overrides, and provider CLI presence without running the slower freshness checks.

## 2. Run A Mock Review

Mock mode is the default. It does not call Claude, Codex, Gemini, or any paid API.

```bash
node scripts/cli.js review "check the project setup" --no-ship --session first-smoke
```

Expected result:

- session state under `.harness/state/sessions/first-smoke/`
- handoff markdown files under `handoffs/`
- no PR or publish action because `--no-ship` is set

Example output:

```text
[review:first-smoke] 1 ideate
[review:first-smoke] 2 plan
[review:first-smoke] 3 implement
[review:first-smoke] 4 self-review
[review:first-smoke] 5 codex-review
[review:first-smoke] 7 ship skipped (--no-ship)
```

For a planning-only first pass:

```bash
node scripts/cli.js plan "draft an implementation plan" --session first-plan
```

## 3. Inspect The Install Catalog

```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --profile developer
node scripts/install-plan.js --profile developer --target claude --json
```

Profiles:

- `core`: minimal rules, agents, hooks, and platform configs
- `developer`: daily development, quality workflow, Codex loop, ops-readiness
- `security`: secure review defaults
- `research`: research-oriented profile
- `full`: every current module

## 4. Use HARNESS In A Target Project

For a disposable end-to-end target project demo:

```bash
npm run demo:external
```

Add `-- --cleanup` if you want the generated target removed after the run:

```bash
npm run demo:external -- --cleanup
```

See [EXAMPLE-PROJECT.md](EXAMPLE-PROJECT.md) for the full walkthrough and expected outputs.

Recommended 0.0.3 integration:

```bash
cd <target-project>
git submodule add https://github.com/Ps-Neko/NEKOWORK.git .harness-tool
```

Run a non-destructive preflight:

```bash
node .harness-tool/scripts/portability/simulate-port.js . --profile developer --verbose
```

Apply generated harness surfaces:

```bash
node .harness-tool/scripts/install-apply.js --profile developer --project-root .
```

Smoke test in the target project:

```bash
node .harness-tool/scripts/cli.js doctor --project-root . --quick
node .harness-tool/scripts/cli.js plan "target project smoke" --project-root . --session target-smoke
```

Expected outputs in the target project:

- `.harness/install-state.json`
- `.harness/state/sessions/target-smoke/`
- `.claude/`
- `.codex/config.toml`
- `.cursor/hooks.json`
- `.gemini/GEMINI.md`
- `.opencode/config.json`

## 5. Turn On Live Provider Calls

Live mode uses local CLI sessions by default.

Claude:

```bash
claude auth status
npm run verify:claude
```

Codex:

```bash
npm install -g @openai/codex
codex login
npm run verify:codex
```

Gemini:

```bash
gemini
npm run verify:gemini
node scripts/cli.js doctor --quick --gemini-smoke
```

Plain `doctor` reports Gemini installation only. Add `--gemini-smoke` when you want the live Gemini auth check included in the health report.

Then run:

```bash
node scripts/cli.js review "live provider smoke" --live --no-ship
```

If you have API key environment variables set, HARNESS blocks them by default before delegated CLI calls. Unset them for local CLI auth:

```bash
unset ANTHROPIC_API_KEY
unset OPENAI_API_KEY
unset GEMINI_API_KEY
unset GOOGLE_API_KEY
```

On PowerShell:

```powershell
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:GOOGLE_API_KEY -ErrorAction SilentlyContinue
```

## 6. Future npm Install Path

The package metadata is already prepared as `@ps-neko/nekowork`, but `private: true` prevents publishing for 0.0.3.

After an explicit public publish decision, the intended install paths are:

```bash
npm i --save-dev @ps-neko/nekowork
```

or:

```bash
npm i -g @ps-neko/nekowork
```

Do not use these npm commands until a public package has actually been published.

## Troubleshooting

`npm ci` fails:

- Confirm Node.js 22 or newer with `node -v`.
- Check corporate proxy or registry settings in `.npmrc`.

`--live` fails immediately:

- Confirm the provider CLI is installed and logged in.
- Unset API key environment variables unless you intentionally opted into a metered path.

`doctor` exits with `FAIL`:

- Read the failed row first.
- Run without `--quick` if you need repair/sync/codemap freshness checks.
- Use `--json` for CI or issue reports.

`repair --check` reports stale output:

- Run `node scripts/repair.js`.
- Then rerun `node scripts/repair.js --check`.

`sync-claude-md --check` reports a diff:

- Run `node scripts/sync-claude-md.js`.

`build-codemaps --check` reports stale codemaps:

- Run `node scripts/build-codemaps.js`.
