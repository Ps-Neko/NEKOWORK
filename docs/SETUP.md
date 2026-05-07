# Setup

Start with [QUICKSTART.md](QUICKSTART.md) if this is your first run. This page is the deeper contributor setup guide.

NEKOWORK `0.1.0-alpha.1` is the current repository candidate. The published `@ps-neko/nekowork@alpha` package remains `0.1.0-alpha.0` until owner-authenticated npm publish completes. Use a source checkout, submodule, or local repository integration when you need examples, tests, or repository-pinned workflows.

## Requirements

- Node.js 22+
- npm
- git
- Optional: Claude Code CLI, Codex CLI, Gemini CLI
- Optional for Rust runtime: Rust toolchain and platform build tools

## Source Checkout

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
node scripts/cli.js doctor --quick
npm run lint
npm test
```

## Local Generated Outputs

Preview the catalog:

```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --profile developer
```

Apply generated harness outputs locally:

```bash
node scripts/install-apply.js --profile developer
```

Check freshness:

```bash
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
```

## Live Provider Setup

Mock mode is the default and requires no provider login. Live mode delegates to local CLI sessions.

### Claude

```bash
claude auth status
npm run verify:claude
```

The default Claude runner uses the local Claude Code CLI session. `ANTHROPIC_API_KEY` is not required.

### Codex

```bash
npm install -g @openai/codex
codex login
codex login status
npm run verify:codex
```

### Gemini

```bash
gemini
npm run verify:gemini
node scripts/cli.js doctor --quick --gemini-smoke
```

Gemini CLI does not expose the same non-interactive auth-status contract as Claude/Codex. Plain `doctor` checks installation and warns that auth was not checked; `doctor --gemini-smoke` runs the explicit live smoke and will fail if headless Gemini auth is not ready.

## API Key Overrides

Unset long-lived provider API keys for delegated local CLI auth:

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

Use `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` only when a metered API-key path is intentional.

## GitHub Auth

GitHub OAuth helpers are optional:

```bash
npm run auth:github:login
npm run auth:github:status
npm run auth:github:logout
```

Workflow file pushes may require a token with `workflow` scope. The local harness does not need this for mock review or source checkout usage.

## Rust Runtime

The Rust runtime is optional for the current alpha:

```bash
npm run verify:runtime
```

The Node CLI remains the primary user path.

## Troubleshooting

`npm ci` fails:

- Confirm `node -v` is 22 or newer.
- Check proxy and registry settings in `.npmrc`.

`doctor` reports stale generated files:

- Run `node scripts/repair.js`.
- Run `node scripts/sync-claude-md.js`.
- Run `node scripts/build-codemaps.js`.

`--live` fails:

- Run `node scripts/cli.js doctor --quick`.
- Confirm provider CLI login.
- Unset API key environment variables unless intentionally opted in.
