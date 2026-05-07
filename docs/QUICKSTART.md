# Quickstart

This guide gets a new user from a clean checkout to the first NEKOWORK run.

## 1. Public Alpha Smoke

The public alpha is available on npm:

```bash
npx -y @ps-neko/nekowork@alpha doctor --quick
```

## 2. Install From Source

Use the repository path when you want examples, tests, or local development:

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
```

Verify the checkout:

```bash
node scripts/cli.js check
```

`check` is the beginner alias for `doctor --quick`. It checks Node.js, package metadata, git state, API key overrides, and provider CLI presence without running the slower freshness checks.

Initialize another local repository from the source checkout:

```bash
node /path/to/harness/scripts/cli.js init --profile developer --project-root /path/to/my-project
```

`init` is the beginner alias for `install --apply`. It writes generated harness surfaces and install state to the target project. It does not commit, push, publish, or deploy.

## 3. One-Minute Demo

Use this first when you want the shortest no-API experience:

```bash
npm run demo:quick -- --cleanup
```

The quick demo creates a disposable target project, runs `doctor -> run -> report -> gate status`, and removes the target when `--cleanup` is set. It uses mock providers and does not call Claude, Codex, Gemini, or paid APIs.

Expected shape:

```text
doctor ... OK
run workflow ... OK
report ... OK
gate status ... OK
Demo completed: verdict=approve_with_fixes, ship_ready=false, applied=false
```

## 3. Beginner Path

Use this path first. It is the recommended shortest safe loop:

```bash
node scripts/cli.js check
node scripts/cli.js run "implement, verify, and prepare ship readiness" --session first-run
node scripts/cli.js report --session first-run
node scripts/cli.js gate status --session first-run
```

`run` is the short safe wrapper. It runs `work -> verify -> ship`, does not apply by default, and stops on Human Gate. `report` writes a readable `REPORT.md` from the evidence already in the session. `apply` is always explicit and requires a verified `SHIP_READY` live-work diff.

## 4. Run A Mock Review

Mock mode is the default. It does not call Claude, Codex, Gemini, or any paid API.

For ambiguous or risky work, start with the local question gate:

```bash
node scripts/cli.js ask "trading dashboard mockup" --session first-ask
```

`ask` creates a question-gate handoff only. It does not call providers and does not mutate project files.

```bash
node scripts/cli.js review "check the project setup" --no-ship --session first-smoke
```

Expected result:

- session state under `.harness/state/sessions/first-smoke/`
- handoff markdown files under `handoffs/`
- `review-summary.json` with `mode: legacy-full-review-cycle`
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

`review-cycle` is an explicit alias for the same legacy full cycle:

```bash
node scripts/cli.js review-cycle "check the project setup" --no-ship --session first-review-cycle
```

For a planning-only first pass:

```bash
node scripts/cli.js plan "draft an implementation plan" --session first-plan
```

For multiple read-only perspectives before implementation:

```bash
node scripts/cli.js team "trading dashboard mockup" --workers planner,research,security,test --no-write --session first-team
```

`team` writes handoffs and a `team-summary.json` file. It does not run an implement stage and does not mutate project files.

For a single-executor implementation handoff:

```bash
node scripts/cli.js work "implement the planned dashboard mockup" --single-executor --session first-work
```

In mock mode this writes an implement handoff only. In live mode the executor works in an isolated git worktree and NEKOWORK captures a diff under the session; the target project is not changed until a later verified apply path exists. `work` also writes `acceptance-criteria.json`, reusing `prd.json` when available or creating a deterministic minimum from the task.

Then verify that work with Codex:

```bash
node scripts/cli.js verify "verify the planned dashboard mockup" --session first-work
```

`verify` reads the prior `work` handoff and optional diff. It does not implement or ship. Add `--secure` when you want Codex challenge even if the task is not auto-detected as sensitive.

If verification creates a human gate, inspect it:

```bash
node scripts/cli.js gate status --session first-work
```

Then make an explicit human decision:

```bash
node scripts/cli.js gate approve --session first-work --reason "Reviewed and accepted this risk"
node scripts/cli.js gate block --session first-work --reason "Release risk rejected"
```

`gate approve` requires an open `HUMAN_GATE`. It records approval for audit; it does not delete the original gate file.

Then produce a ship/no-ship readiness handoff:

```bash
node scripts/cli.js ship "prepare dashboard ship readiness" --require-clean-gates --session first-work
```

`ship` requires the prior `work` and `verify` handoffs. It does not publish, deploy, create a PR, or mutate the target project. If Codex reported fixable findings, `ship` writes a no-ship handoff and `NO_SHIP`; if Codex fully approved, it writes `SHIP_READY`. Existing `HUMAN_GATE` always blocks it.

Create a readable report from the session evidence:

```bash
node scripts/cli.js report --session first-work
```

`report` is inspect-only. It writes `REPORT.md` and `report-summary.json` under the session directory and does not mutate project files.

For live work that produced a captured diff, apply it only after ship readiness:

```bash
node scripts/cli.js apply --session first-work
```

`apply` requires `SHIP_READY`, no newer `NO_SHIP`, no unresolved gate, a clean git worktree excluding `.harness/` state, and a captured diff from `work --live`. It applies the diff but does not commit, push, publish, or deploy.

To run the decomposed wrapper in one command:

```bash
node scripts/cli.js run "implement and verify a change" --session first-run
```

`run` executes `work -> verify -> ship`. It does not apply by default. Add `--apply` only when live work produced a captured diff and you want the verified `SHIP_READY` diff applied.

## 5. Inspect The Install Catalog

```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --pack quality
node scripts/install-plan.js --profile developer
node scripts/install-plan.js --profile developer --target claude --json
```

Profiles:

- `core`: minimal rules, agents, hooks, and platform configs
- `developer`: daily development, quality workflow, Codex loop, ops-readiness
- `security`: secure review defaults
- `product`: question gate, scope review, acceptance criteria
- `quality`: disciplined workflow, test-first planning, evidence-based review
- `frontend`: UI mockup, component review, accessibility-oriented flow
- `testing`: test planning, regression, and coverage-oriented flow
- `research`: research-oriented profile
- `full`: every current module

Official packs:

- `core`: minimal verification runtime
- `quality`: disciplined workflow and acceptance coverage evidence
- `security`: sensitive work, Codex challenge, and Human Gate policy
- `frontend`: UI mockups, component review, and accessibility-oriented checks
- `testing`: regression planning and coverage-oriented handoffs
- `release`: release readiness over the developer profile
- `enterprise`: full stable catalog with all gates intact

## 6. Use HARNESS In A Target Project

For a disposable end-to-end target project demo:

```bash
npm run demo:external
```

Add `-- --cleanup` if you want the generated target removed after the run:

```bash
npm run demo:external -- --cleanup
```

See [EXAMPLE-PROJECT.md](EXAMPLE-PROJECT.md) for the full walkthrough and expected outputs.

For small checked-in case-study targets, inspect:

```text
examples/trading-dashboard-mock/
examples/github-actions-hardening/
```

Each example has its own `npm test` and NEKOWORK case-study artifacts under `case-study/`.

Recommended repository integration:

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

## 7. Turn On Live Provider Calls

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

## 8. npm Install Path

The public alpha is published as `@ps-neko/nekowork@alpha`:

```bash
npm i --save-dev @ps-neko/nekowork@alpha
```

or:

```bash
npm i -g @ps-neko/nekowork@alpha
```

For alpha pinning, prefer:

```bash
npx -y @ps-neko/nekowork@alpha doctor --quick
```

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
