# NEKOWORK

Local-first AI development harness for Claude Code, Codex CLI, and Gemini CLI.

[![harness-validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

NEKOWORK packages the HARNESS runtime: one source catalog, `agent.yaml`, projected into Claude Code, Codex CLI, Cursor, Gemini CLI, and OpenCode surfaces.

Claude writes or plans, Codex challenges the result in a separate context, and human gates stop critical or repeated-risk changes.

## Status

- Current version: `0.0.2` alpha
- Current package name: `@ps-neko/nekowork`
- npm publishing: disabled for now by `private: true`
- Supported install path today: clone, submodule, or local repository integration
- Future npm path is prepared, but `npm publish` still requires an explicit release decision
- Default mode: mock providers, no API keys, no provider CLI calls

## Quick Start

Requirements:

- Node.js 22+
- npm
- git

Run HARNESS from source:

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
node scripts/cli.js doctor --quick
node scripts/cli.js review "check the project setup" --no-ship --session first-smoke
```

The default review path uses mock providers, so it does not need API keys or provider CLIs.

For the fuller first-run guide, see [docs/QUICKSTART.md](docs/QUICKSTART.md).

## What You Get

```text
[review:first-smoke] 1 ideate
[review:first-smoke] 2 plan
[review:first-smoke] 3 implement
[review:first-smoke] 4 self-review
[review:first-smoke] 5 codex-review
[review:first-smoke] 7 ship skipped (--no-ship)
```

Outputs are written under:

```text
.harness/state/sessions/<session-id>/handoffs/
```

## Use It In Another Project

Recommended 0.0.2 shape:

```bash
cd <target-project>
git submodule add https://github.com/Ps-Neko/NEKOWORK.git .harness-tool
node .harness-tool/scripts/portability/simulate-port.js . --profile developer --verbose
node .harness-tool/scripts/install-apply.js --profile developer --project-root .
node .harness-tool/scripts/cli.js doctor --project-root . --quick
node .harness-tool/scripts/cli.js plan "first NEKOWORK smoke" --project-root .
```

The HARNESS tool root stays in `.harness-tool/`. Session state, generated harness files, and git work happen in the target project root.

## Live Provider Auth

Live mode delegates auth to local CLI sessions:

```bash
claude auth status
codex login
gemini

node scripts/cli.js review "live local smoke" --live --no-ship
```

Long-lived API key environment variables are blocked by default before provider CLI calls:

- Claude: `ANTHROPIC_API_KEY`
- Codex: `OPENAI_API_KEY`
- Gemini: `GEMINI_API_KEY`, `GOOGLE_API_KEY`

Use API-key paths only with explicit opt-in, for example `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1`.

## Main Surface

The public alpha surface is intentionally small:

- `doctor`: inspect local readiness
- `plan`: create a planning handoff
- `review`: run the Claude-led/Codex-reviewed workflow
- `install --plan` / `install --apply`: project generated harness surfaces

Advanced features such as `team-lite`, `ralph`, instincts, cost tracking, and the Rust supervisor are documented in [docs/ADVANCED.md](docs/ADVANCED.md).

## Catalog

- Agents: 11
- Skills: 9
- Hooks: 5
- Modules: 7
- Profiles: `core`, `developer`, `security`, `research`, `full`
- Harness targets: `claude`, `codex`, `cursor`, `gemini`, `opencode`

Key skills:

- `claude-led-codex-review`
- `plan-eng-review`
- `tdd-workflow`
- `review`
- `ship`
- `ralph`
- `security-hardening`
- `release-readiness`
- `porting`

## Common Commands

```bash
node scripts/cli.js doctor
node scripts/install-plan.js --list
node scripts/install-plan.js --profile developer
node scripts/install-apply.js --profile developer --project-root <target>

node scripts/cli.js plan "draft a safe implementation plan"
node scripts/cli.js review "implement and review this change" --no-ship
node scripts/cli.js review "security-sensitive change" --secure --no-ship

npm run lint
npm test
npm audit --audit-level=moderate
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
```

## Release Gates

Before any tag or public npm decision, run:

```bash
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
npm run security:hardening
npm pack --dry-run --json
```

`npm pack --dry-run --json` currently produces a package named like `ps-neko-nekowork-0.0.2.tgz`. It does not publish.

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md) - first run and common paths
- [docs/DEMO.md](docs/DEMO.md) - sample command output and generated files
- [docs/SECURITY.md](docs/SECURITY.md) - local-first auth and safety model
- [docs/ADVANCED.md](docs/ADVANCED.md) - advanced workflows and runtime features
- [docs/SETUP.md](docs/SETUP.md) - local contributor setup and live provider smoke
- [docs/PORTING.md](docs/PORTING.md) - using HARNESS in an external project
- [docs/RELEASE-READINESS.md](docs/RELEASE-READINESS.md) - release and publish gates
- [docs/RUNBOOK.md](docs/RUNBOOK.md) - operations guide
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system architecture
- [docs/AUDIT.md](docs/AUDIT.md) - readiness and remaining debt
- [docs/CHANGELOG.md](docs/CHANGELOG.md) - project history
- [SOUL.md](SOUL.md), [RULES.md](RULES.md), [AGENTS.md](AGENTS.md) - project principles and agent rules

## License

MIT
