# Porting NEKOWORK Into Another Project

NEKOWORK `0.1.0-alpha.8` is the current public alpha. The published `@ps-neko/nekowork@alpha` package points at `0.1.0-alpha.8`. Use npm alpha for the shortest published install path, or use a submodule/local checkout for repository-pinned workflows and examples.

## Local Demo First

Before touching a real target project, run the disposable external-project demo from the NEKOWORK checkout:

```bash
npm run demo:external
```

The demo creates a tiny target project, runs the porting preflight, applies generated harness outputs, runs `doctor --quick`, and creates a planning session. Use `npm run demo:external -- --cleanup` when you want the generated target removed after success.

## Recommended Shape

```text
target-project/
  .harness-tool/             # NEKOWORK checkout or submodule
  .harness/                  # generated install/session state
  .claude/                   # generated Claude Code surface
  .codex/config.toml         # generated Codex surface
  .cursor/hooks.json         # generated Cursor surface
  .gemini/GEMINI.md          # generated Gemini surface
  .opencode/config.json      # generated OpenCode surface
```

The tool root stays in `.harness-tool/`. Generated harness files, session state, and git-aware execution target the project root.

## npm Alpha Install

Use this when you want the shortest target-project install path:

```bash
cd <target-project>
npx -y @ps-neko/nekowork@alpha init --profile developer --project-root .
npx -y @ps-neko/nekowork@alpha check --project-root .
```

## Submodule Install

```bash
cd <target-project>
git submodule add https://github.com/Ps-Neko/NEKOWORK.git .harness-tool
node .harness-tool/scripts/portability/simulate-port.js . --profile developer --verbose
node .harness-tool/scripts/install-apply.js --profile developer --project-root .
node .harness-tool/scripts/cli.js doctor --project-root . --quick
node .harness-tool/scripts/cli.js plan "target project smoke" --project-root . --session target-smoke
```

## Local Checkout Install

Use this when developing NEKOWORK and testing it against another project:

```bash
cd C:/Users/Mun/harness
node scripts/portability/simulate-port.js <target-project> --profile developer --verbose
node scripts/install-apply.js --profile developer --project-root <target-project>
node scripts/cli.js doctor --project-root <target-project> --quick
node scripts/cli.js plan "target project smoke" --project-root <target-project> --session target-smoke
```

## What To Check

After `install-apply`, confirm these exist in the target project:

- `.harness/install-state.json`
- `.harness/state/sessions/`
- `.claude/`
- `.codex/config.toml`
- `.cursor/hooks.json`
- `.gemini/GEMINI.md`
- `.opencode/config.json`

The generated files are derived from `agent.yaml`, `agents/`, `skills/`, `hooks/`, `rules/`, and `manifests/` in the NEKOWORK tool root.

## Live Provider Auth

Mock mode is the default and does not need provider CLIs. Live mode delegates to local CLI sessions:

```bash
claude auth status
codex login status
gemini
```

Then run:

```bash
node .harness-tool/scripts/cli.js doctor --project-root . --quick --gemini-smoke
node .harness-tool/scripts/cli.js review "live smoke" --project-root . --live --no-ship
```

Unset long-lived provider API keys unless you intentionally opt into metered API-key paths:

```bash
unset ANTHROPIC_API_KEY
unset OPENAI_API_KEY
unset GEMINI_API_KEY
unset GOOGLE_API_KEY
```

PowerShell:

```powershell
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:GOOGLE_API_KEY -ErrorAction SilentlyContinue
```

## Profiles

- `core`: minimum rules, agents, hooks, and platform configs
- `developer`: default daily workflow profile
- `security`: security-focused review/challenge defaults
- `research`: research agent and Gemini-oriented surface
- `full`: all declared modules

Preview a profile before applying it:

```bash
node .harness-tool/scripts/install-plan.js --profile developer --project-root .
node .harness-tool/scripts/install-plan.js --list
```

## Refresh After Catalog Changes

When NEKOWORK changes:

```bash
git -C .harness-tool pull --ff-only
node .harness-tool/scripts/install-apply.js --profile developer --project-root .
node .harness-tool/scripts/repair.js --check
node .harness-tool/scripts/sync-claude-md.js --check
node .harness-tool/scripts/build-codemaps.js --check
```

## Troubleshooting

`simulate-port` reports high conflict:

- Inspect existing `.harness`, `.harness-tool`, `.mcp.json`, `CLAUDE.md`, and `AGENTS.md`.
- Prefer a dry run first and keep project-owned sections outside generated marker blocks.

`doctor` reports API key warnings:

- Unset provider API key variables.
- Use `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` only for intentional metered calls.

`doctor --gemini-smoke` fails:

- Run interactive `gemini` once and choose Google login.
- Or configure Vertex/ADC auth for the local Gemini CLI.
- Re-run `npm run verify:gemini` from the NEKOWORK checkout.

Generated outputs are stale:

- Run `node .harness-tool/scripts/install-apply.js --profile developer --project-root .`.
- Re-run `node .harness-tool/scripts/cli.js doctor --project-root .`.

## Version Pinning

For PoC work, pin the NEKOWORK submodule to a tag such as `v0.0.3`. Avoid `latest`-style moving references in production workflows.
