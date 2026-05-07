# NEKOWORK

Local-first AI development quality runtime for Claude Code, Codex CLI, and Gemini CLI.

[![harness-validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

NEKOWORK prevents AI coding agents from shipping unverified changes.

It runs:

1. Work
2. Independent verification
3. Human approval
4. Explicit apply

No auto-commit. No auto-push. No surprise deploy.

Product principle:

```text
NEKOWORK = Claude work -> Codex verification -> Human Gate
```

NEKOWORK is the product. HARNESS is the local runtime it packages: one source catalog, `agent.yaml`, projected into Claude Code, Codex CLI, Cursor, Gemini CLI, and OpenCode surfaces.

NEKOWORK is intentionally not a 100-agent pack. Every agent, skill, hook, profile, module, and pack must:

1. improve verification,
2. preserve one-executor writes,
3. produce auditable evidence,
4. respect Human Gate.

**Public alpha evidence:** 7 packs / 9 profiles / 36 components / 5 harness targets / 7 case-study flows / 252 tests / 0 moderate+ npm audit issues / fresh `npx @alpha` smoke

NEKOWORK does not automatically commit, push, publish, deploy, or apply diffs. `apply` is explicit and requires verified ship-ready evidence.

**One-minute demo:** [terminal transcript](docs/DEMO.md#one-minute-terminal-transcript) / [full report example](docs/DEMO-REPORT.md) / [alpha feedback](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml) / [roadmap](docs/ROADMAP.md)

![NEKOWORK one-minute terminal demo](docs/assets/demo-terminal.svg)

## Start Here

Use the current npm alpha for the published health smoke:

```bash
npx -y @ps-neko/nekowork@alpha check
```

Use a source checkout for the new simple command path:

```bash
node scripts/cli.js check
node scripts/cli.js run "implement this safely" --session first-run
node scripts/cli.js report --session first-run
node scripts/cli.js gate status --session first-run
```

The simple path maps to the full evidence loop: `check = doctor --quick`, and `run = work -> verify -> ship`.

To add generated harness surfaces to another local repository:

```bash
cd /path/to/my-project
npx -y @ps-neko/nekowork@alpha init --profile developer --project-root .
```

## Example Report

`report` is the main trust surface. It turns session evidence into a readable `REPORT.md`:

```text
Verdict: approve_with_fixes
Ship ready: false
Human gate: required
Applied: false
Profile: quality
Strict quality: enabled
Acceptance coverage: 4/5
Quality warnings: 2

Evidence:
- work-summary.json
- verify-summary.json
- ship-summary.json
- gate-summary.json
```

See the full report contract and example artifact in [docs/DEMO-REPORT.md](docs/DEMO-REPORT.md), and the one-minute terminal transcript in [docs/DEMO.md](docs/DEMO.md).

## Human Gate Example

```text
Risk: security-sensitive auth parser change
Codex verdict: approve_with_fixes
Ship ready: false

Required before apply:
[ ] Add parser boundary test
[ ] Remove long-lived API key env fallback
[ ] Re-run verify --strict-quality

Decision:
- approve
- block
- request fixes
```

Human Gate is the point where NEKOWORK stops being an autopilot and becomes an approval system.

## Compared With Agent Packs

| Tool pattern | Optimizes for | NEKOWORK optimizes for |
|---|---|---|
| Large Claude Code packs | More agents, commands, skills | Curated verification loop |
| Team simulation | More specialist perspectives | Read-only team plus one executor |
| Autopilot | Fast autonomous execution | Report, gate, explicit apply |
| Discipline workflows | Better development habits | Evidence-backed ship decision |

## When To Choose What

| Use case | Prefer |
|---|---|
| Add TDD and discipline habits to Claude Code | Superpowers |
| Get the broadest Claude Code skill/command environment | Everything Claude Code |
| Simulate startup team roles from planning to QA | GStack |
| Run autonomous multi-agent execution | OMC |
| Verify AI changes, require human approval, then apply explicitly | NEKOWORK |

## Three Paths

Most users should start with the Beginner path. The other paths are for explicit phase control or legacy compatibility.

1. Beginner: `check -> run -> report -> gate`
2. Advanced: `ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply`
3. Legacy: `review` / `review-cycle`

## Why NEKOWORK

NEKOWORK is for teams that want AI-assisted development without making the agent catalog the product. The default path keeps local auth, inspectable handoffs, single-executor writes, independent Codex verification, and Human Gate decisions in front of risky ship/apply steps.

## Status

- Current repository version: `0.1.0-alpha.4`
- Current package name: `@ps-neko/nekowork`
- Current npm alpha: `@ps-neko/nekowork@0.1.0-alpha.4`
- Supported install path today: npm alpha, clone, submodule, or local repository integration
- Dist-tag note: use `@alpha` until a stable release; `latest` still points at the first alpha line
- Default mode: mock providers, no API keys, no provider CLI calls

Current local verification:

- `npm run lint`: pass
- `npm test`: 252 tests pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass
- `npx -y @ps-neko/nekowork@alpha check`: pass with warnings only

## Case-study Evidence

| Flow | Risk type | Evidence produced |
|---|---|---|
| Financial UI mock | UI/product risk | report + Human Gate |
| GitHub Actions hardening | CI/security risk | security findings + no-ship/ship evidence |
| Quality lifecycle smoke | quality risk | strict-quality + acceptance coverage |
| npm package boundary | package/release risk | pack/audit evidence |
| Auth parser boundary | auth/security risk | parser boundary evidence |
| Python protocol parser | protocol correctness risk | test-backed verification |
| Dotenv configuration boundary | config/security risk | no-secret parser evidence |

## Official Packs

| Pack | Adds | Use when |
|---|---|---|
| `core` | minimal verification runtime | first install or repo smoke |
| `quality` | acceptance coverage, strict evidence prompts | feature work needs proof |
| `security` | auth/secrets/deploy risk prompts | sensitive changes |
| `frontend` | UI mockup, component review, accessibility checks | product-facing UI work |
| `testing` | regression planning and coverage handoffs | test confidence is the main risk |
| `release` | ship/no-ship evidence | pre-release checks |
| `enterprise` | full catalog with all gates | high-control teams |

## Quick Start

Requirements:

- Node.js 22+
- npm
- git

Fastest no-API demo:

```bash
npx -y @ps-neko/nekowork@alpha check
```

Repository demo:

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
npm run demo:quick -- --cleanup
```

This creates a disposable target project and runs `doctor -> run -> report -> gate status`. It uses mock providers and does not call Claude, Codex, Gemini, or paid APIs.

Recommended path for most users:

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
node scripts/cli.js check
node scripts/cli.js run "implement, verify, and prepare ship readiness" --session first-run
node scripts/cli.js report --session first-run
node scripts/cli.js gate status --session first-run
```

`run` executes `work -> verify -> ship`. `report` turns the session evidence into a readable `REPORT.md`. It does not apply by default. `apply` is always explicit and requires a verified `SHIP_READY` live-work diff.

To initialize another local repository with the published alpha:

```bash
cd /path/to/my-project
npx -y @ps-neko/nekowork@alpha init --profile developer --project-root .
```

Advanced path:

```text
ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply
```

Legacy compatibility smoke:

```bash
node scripts/cli.js review "check the project setup" --no-ship --session first-smoke
```

The default review path uses mock providers, so it does not need API keys or provider CLIs.

For the fuller first-run guide, see [docs/QUICKSTART.md](docs/QUICKSTART.md).

For the trust and recovery model, see [Safety Guarantees](docs/SAFETY-GUARANTEES.md), [Failure Modes](docs/FAILURE-MODES.md), [Trust Model](docs/TRUST-MODEL.md), and [Why Not Autopilot](docs/WHY-NOT-AUTOPILOT.md).

To see the repository-based external project flow end to end:

```bash
npm run demo:external
```

To inspect small case-study targets, see [examples/trading-dashboard-mock](examples/trading-dashboard-mock), [examples/github-actions-hardening](examples/github-actions-hardening), [examples/quality-lifecycle-smoke](examples/quality-lifecycle-smoke), and [docs/case-studies](docs/case-studies). They demonstrate financial UI, CI workflow, quality lifecycle, npm package, auth parser, Python protocol library, and environment configuration flows while still preserving Codex verification, Human Gate policy, and explicit apply control.

## What You Get

```text
doctor ... OK
run workflow ... OK
report ... OK
gate status ... OK
Demo completed: verdict=approve_with_fixes, ship_ready=false, applied=false
```

Outputs are written under:

```text
.harness/state/sessions/<session-id>/handoffs/
.harness/state/sessions/<session-id>/REPORT.md
```

## Use It In Another Project

Shortest npm alpha install shape:

```bash
cd <target-project>
npx -y @ps-neko/nekowork@alpha init --profile developer --project-root .
npx -y @ps-neko/nekowork@alpha check --project-root .
```

Repository-pinned install shape:

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
- `report`: summarize session evidence into `REPORT.md` without project mutation
- `review`: run the legacy full Claude-led/Codex-reviewed workflow
- `review-cycle`: explicit compatibility alias for the legacy full review workflow
- `install --plan` / `install --apply`: project generated harness surfaces

Advanced features such as `team-lite`, `ralph`, `wait`, instincts, cost tracking, and the Rust supervisor are documented in [docs/ADVANCED.md](docs/ADVANCED.md).

`plan` is recommended before `work` for larger changes. The current `run` command intentionally stays compact: it runs `work -> verify -> ship`, records acceptance criteria through `work`, and applies only when `--apply` is explicitly provided.

Use `--profile quality` or `--profile security` on `work`, `verify`, and `run` when a task needs stronger evidence prompts. Add `--strict-quality` to `verify` or `run` when missing evidence or acceptance coverage should become a fix-required verdict before ship.

Use official packs when choosing an install shape:

```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --pack quality
node scripts/install-plan.js --pack security --target codex --json
```

Packs are aliases over validated profiles. They add clearer product packaging without weakening the core gates.

## Catalog

- Agents: 11
- Skills: 10
- Hooks: 5
- Modules: 7
- Profiles: `core`, `developer`, `security`, `product`, `quality`, `frontend`, `testing`, `research`, `full`
- Official packs: `core`, `quality`, `security`, `frontend`, `testing`, `release`, `enterprise`
- Harness targets: `claude`, `codex`, `cursor`, `gemini`, `opencode`

Key skills:

- `claude-led-codex-review`
- `plan-eng-review`
- `tdd-workflow`
- `acceptance-coverage`
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
npm run demo:quick
node scripts/install-plan.js --list
node scripts/install-plan.js --pack quality
node scripts/install-plan.js --profile developer
node scripts/install-apply.js --profile developer --project-root <target>

node scripts/cli.js ask "clarify a risky or ambiguous request"
node scripts/cli.js plan "draft a safe implementation plan"
node scripts/cli.js team "collect read-only worker handoffs" --workers planner,research,security,test --no-write
node scripts/cli.js work "implement the planned change with one executor" --single-executor --session work-smoke
node scripts/cli.js verify "verify the implemented change" --session work-smoke
node scripts/cli.js verify "verify quality evidence" --profile quality --strict-quality --session work-smoke
node scripts/cli.js gate status --session work-smoke
node scripts/cli.js ship "prepare ship readiness" --require-clean-gates --session work-smoke
node scripts/cli.js report --session work-smoke
node scripts/cli.js apply --session work-smoke
node scripts/cli.js run "implement, verify, and prepare ship readiness" --session run-smoke
node scripts/cli.js report --session run-smoke
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

`npm pack --dry-run --json` currently produces a package named like `ps-neko-nekowork-0.1.0-alpha.4.tgz`. It does not publish.

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md) - first run and common paths
- [docs/WHY-NEKOWORK.md](docs/WHY-NEKOWORK.md) - comparison and product positioning
- [docs/CATALOG-PACKS.md](docs/CATALOG-PACKS.md) - curated catalog, official packs, and case-study evidence
- [docs/PUBLISH-ALPHA.md](docs/PUBLISH-ALPHA.md) - public npm alpha release plan
- [docs/ROADMAP.md](docs/ROADMAP.md) - small alpha roadmap and non-goals
- [docs/FEEDBACK-TRIAGE.md](docs/FEEDBACK-TRIAGE.md) - alpha feedback classification and response guide
- [docs/INTERNAL-PROVIDER.md](docs/INTERNAL-PROVIDER.md) - private command adapter protocol
- [docs/DEMO.md](docs/DEMO.md) - sample command output and generated files
- [docs/DEMO-REPORT.md](docs/DEMO-REPORT.md) - readable session report UX
- [docs/EXAMPLE-PROJECT.md](docs/EXAMPLE-PROJECT.md) - repository-based external project demo
- [docs/case-studies](docs/case-studies) - real external project run evidence
- [examples/trading-dashboard-mock](examples/trading-dashboard-mock) - standalone financial UI mock target and case-study evidence
- [examples/quality-lifecycle-smoke](examples/quality-lifecycle-smoke) - standalone quality profile and strict-quality case-study evidence
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
- [docs/examples/QUALITY-LIFECYCLE-SMOKE.md](docs/examples/QUALITY-LIFECYCLE-SMOKE.md) - quality profile flow with evidence and acceptance coverage
- [docs/AUDIT.md](docs/AUDIT.md) - readiness and remaining debt
- [docs/CHANGELOG.md](docs/CHANGELOG.md) - project history
- [SOUL.md](SOUL.md), [RULES.md](RULES.md), [AGENTS.md](AGENTS.md) - project principles and agent rules

## License

MIT
