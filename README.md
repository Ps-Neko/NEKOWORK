# NEKOWORK

Local-first AI development harness for Claude Code, Codex CLI, and Gemini CLI.

[![harness-validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

NEKOWORK is the product. HARNESS is the local runtime it packages: one source catalog, `agent.yaml`, projected into Claude Code, Codex CLI, Cursor, Gemini CLI, and OpenCode surfaces.

Claude writes or plans, Codex challenges the result in a separate context, and human gates stop critical or repeated-risk changes.

NEKOWORK is also a quality runtime: it combines disciplined development workflow, product-aware planning, read-only multi-agent review, independent Codex verification, Human Gate approval, and explicit apply control.

Product principle:

```text
NEKOWORK = Claude work -> Codex verification -> Human Gate
```

NEKOWORK is not meant to become a large agent pack. Skills, hooks, profiles, and team modes are added only when they preserve the verification loop.

## Three Paths

Most users should start with the Beginner path. The other paths are for explicit phase control or legacy compatibility.

1. Beginner: `doctor -> ask -> run -> gate`
2. Advanced: `ask -> plan -> team -> work -> verify -> gate -> ship -> apply`
3. Legacy: `review` / `review-cycle`

## Why NEKOWORK

NEKOWORK is for teams that want AI-assisted development without making the agent catalog the product. The default path keeps local auth, inspectable handoffs, single-executor writes, independent Codex verification, and Human Gate decisions in front of risky ship/apply steps.

## Status

- Current version: `0.0.3` alpha
- Current package name: `@ps-neko/nekowork`
- npm publishing: do not publish `0.0.3`; disabled by `private: true`
- Supported install path today: clone, submodule, or local repository integration
- Future npm path is prepared, but `npm publish` requires a new explicit release decision
- Default mode: mock providers, no API keys, no provider CLI calls

Current local verification:

- `npm run lint`: pass
- `npm test`: 227 tests pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass

## Quick Start

Requirements:

- Node.js 22+
- npm
- git

Recommended path for most users:

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
node scripts/cli.js doctor --quick
node scripts/cli.js ask "clarify a risky or ambiguous request" --session first-ask
node scripts/cli.js run "implement, verify, and prepare ship readiness" --session first-run
node scripts/cli.js gate status --session first-run
```

`run` executes `work -> verify -> ship`. It does not apply by default. `apply` is always explicit and requires a verified `SHIP_READY` live-work diff.

Advanced path:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> apply
```

Legacy compatibility smoke:

```bash
node scripts/cli.js review "check the project setup" --no-ship --session first-smoke
```

The default review path uses mock providers, so it does not need API keys or provider CLIs.

For the fuller first-run guide, see [docs/QUICKSTART.md](docs/QUICKSTART.md).

To see the repository-based external project flow end to end:

```bash
npm run demo:external
```

To inspect small case-study targets, see [examples/trading-dashboard-mock](examples/trading-dashboard-mock) and [examples/github-actions-hardening](examples/github-actions-hardening). They demonstrate financial UI and CI workflow changes passing local checks while still requiring Human Gate policy.

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

Recommended 0.0.3 shape:

```bash
cd <target-project>
git submodule add https://github.com/Ps-Neko/NEKOWORK.git .harness-tool
node .harness-tool/scripts/portability/simulate-port.js . --profile developer --verbose
node .harness-tool/scripts/install-apply.js --profile developer --project-root .
node .harness-tool/scripts/cli.js doctor --project-root . --quick
node .harness-tool/scripts/cli.js plan "first NEKOWORK smoke" --project-root .
```

The HARNESS tool root stays in `.harness-tool/`. Session state, generated harness files, and git work happen in the target project root.

For a disposable external-project walkthrough, see [docs/EXAMPLE-PROJECT.md](docs/EXAMPLE-PROJECT.md).

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
- `ask`: clarify goal, scope, risk, and success criteria without provider calls
- `plan`: create a planning handoff
- `team`: create read-only handoffs from multiple worker perspectives
- `work`: let a single executor produce an implement handoff and isolated diff
- `verify`: run Codex-only verification on a prior work handoff
- `gate`: inspect, approve, or block a human gate for a session
- `ship`: produce a ship/no-ship readiness handoff after Codex verification
- `apply`: apply a verified `SHIP_READY` live-work diff to the target project
- `run`: execute the decomposed wrapper, `work -> verify -> ship`, with optional apply
- `review`: run the legacy full Claude-led/Codex-reviewed workflow
- `review-cycle`: explicit compatibility alias for the legacy full review workflow
- `install --plan` / `install --apply`: project generated harness surfaces

Advanced features such as `team-lite`, `ralph`, `wait`, instincts, cost tracking, and the Rust supervisor are documented in [docs/ADVANCED.md](docs/ADVANCED.md).

`plan` is recommended before `work` for larger changes. The current `run` command intentionally stays compact: it runs `work -> verify -> ship`, records acceptance criteria through `work`, and applies only when `--apply` is explicitly provided.

## Catalog

- Agents: 11
- Skills: 9
- Hooks: 5
- Modules: 7
- Profiles: `core`, `developer`, `security`, `product`, `quality`, `frontend`, `testing`, `research`, `full`
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
node scripts/cli.js doctor --quick --gemini-smoke
node scripts/install-plan.js --list
node scripts/install-plan.js --profile developer
node scripts/install-apply.js --profile developer --project-root <target>

node scripts/cli.js ask "clarify a risky or ambiguous request"
node scripts/cli.js plan "draft a safe implementation plan"
node scripts/cli.js team "collect read-only worker handoffs" --workers planner,research,security,test --no-write
node scripts/cli.js work "implement the planned change with one executor" --single-executor --session work-smoke
node scripts/cli.js verify "verify the implemented change" --session work-smoke
node scripts/cli.js gate status --session work-smoke
node scripts/cli.js ship "prepare ship readiness" --require-clean-gates --session work-smoke
node scripts/cli.js apply --session work-smoke
node scripts/cli.js run "implement, verify, and prepare ship readiness" --session run-smoke
node scripts/cli.js review "implement and review this change" --no-ship
node scripts/cli.js review-cycle "legacy full-cycle compatibility smoke" --no-ship
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

`npm pack --dry-run --json` currently produces a package named like `ps-neko-nekowork-0.0.3.tgz`. It does not publish.

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md) - first run and common paths
- [docs/DEMO.md](docs/DEMO.md) - sample command output and generated files
- [docs/EXAMPLE-PROJECT.md](docs/EXAMPLE-PROJECT.md) - repository-based external project demo
- [examples/trading-dashboard-mock](examples/trading-dashboard-mock) - standalone financial UI mock target and case-study evidence
- [docs/SECURITY.md](docs/SECURITY.md) - local-first auth and safety model
- [docs/ADVANCED.md](docs/ADVANCED.md) - advanced workflows and runtime features
- [docs/SETUP.md](docs/SETUP.md) - local contributor setup and live provider smoke
- [docs/PORTING.md](docs/PORTING.md) - using HARNESS in an external project
- [docs/RELEASE-READINESS.md](docs/RELEASE-READINESS.md) - release and publish gates
- [docs/RUNBOOK.md](docs/RUNBOOK.md) - operations guide
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system architecture
- [docs/PRODUCT-PRINCIPLES.md](docs/PRODUCT-PRINCIPLES.md) - product position, invariants, CLI phase semantics
- [docs/AI-DEVELOPMENT-LIFECYCLE.md](docs/AI-DEVELOPMENT-LIFECYCLE.md) - quality runtime and disciplined AI development lifecycle
- [docs/CORE-INVARIANTS.md](docs/CORE-INVARIANTS.md) - non-negotiable runtime safety rules
- [docs/CLI-STAGES.md](docs/CLI-STAGES.md) - stage contract and compatibility transition
- [docs/RISK-CLASSIFIER.md](docs/RISK-CLASSIFIER.md) - shared risk tags, challenge, and gate policy
- [docs/examples/TRADING-DASHBOARD-MOCK.md](docs/examples/TRADING-DASHBOARD-MOCK.md) - financial mockup flow with Human Gate
- [docs/examples/GITHUB-ACTIONS-HARDENING.md](docs/examples/GITHUB-ACTIONS-HARDENING.md) - CI workflow hardening flow with Human Gate
- [docs/AUDIT.md](docs/AUDIT.md) - readiness and remaining debt
- [docs/CHANGELOG.md](docs/CHANGELOG.md) - project history
- [SOUL.md](SOUL.md), [RULES.md](RULES.md), [AGENTS.md](AGENTS.md) - project principles and agent rules

## License

MIT
