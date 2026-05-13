# NEKOWORK

[English](README.md) | [한국어](README.ko.md)

Verified Autopilot for AI code changes.

[![validate](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml/badge.svg)](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml)

AI builds. Codex verifies. You approve the boundary.

NEKOWORK plans, edits, verifies, repairs, and prepares ship-ready AI code changes. Final apply remains human-controlled.

Note: "Verified" means independently reviewed with recorded evidence, not mathematically proven correctness. NEKOWORK combines Codex review, test evidence, risk policy, Human Gate, and explicit apply boundaries.

It runs:

1. Autonomous planning and build
2. Independent Codex verification
3. Bounded repair when findings are fixable
4. Report, ship/no-ship, and Human Gate
5. Explicit apply only when the human chooses it

No auto-commit. No auto-push. No surprise deploy.

Product principle:

```text
NEKOWORK = verified autopilot -> Codex verification -> Human Gate -> explicit apply
```

```text
Autonomous until apply.
Verified before ship.
Human-controlled at the boundary.
```

NEKOWORK packages a local runtime with one source catalog, `agent.yaml`, projected into Claude Code, Codex CLI, Cursor, Gemini CLI, and OpenCode surfaces. Use `nekowork` as the public CLI; `harness` remains a legacy/internal alias.

NEKOWORK is intentionally not a 100-agent pack. Every agent, skill, hook, profile, module, and pack must:

1. improve verification,
2. preserve one-executor writes,
3. produce auditable evidence,
4. respect Human Gate.

**Public alpha evidence:** 293 tests / 0 moderate+ npm audit issues / fresh `npx @alpha` smoke / 8 case-study flows / 5 starter packs

NEKOWORK does not automatically commit, push, publish, deploy, or apply diffs. `apply` is explicit and requires verified ship-ready evidence.

For bounded autonomy before that boundary, use `auto`: it can route, build, verify, repair fixable findings within a budget, write a report, and then stop before apply.

NEKOWORK also maps the verified autopilot flow to 12 practical agentic harness patterns: routing, planning, read-only team review, independent verification, Human Gate, tool gates, memory, and evolution loops. See [docs/AGENTIC-PATTERNS.md](docs/AGENTIC-PATTERNS.md).

Next track: alpha.9 focuses on evidence and product-surface clarity before adding parallel candidate writers.

**Latest alpha evidence:** [CI badge](https://github.com/Ps-Neko/NEKOWORK/actions/workflows/harness-validate.yml) / [npm package](https://www.npmjs.com/package/@ps-neko/nekowork) / [smoke transcript](docs/DEMO.md#one-minute-terminal-transcript) / [report artifact](docs/DEMO-REPORT.md)

**One-minute demo:** [terminal transcript](docs/DEMO.md#one-minute-terminal-transcript) / [full report example](docs/DEMO-REPORT.md) / [external run kit](docs/EXTERNAL-RUN.md) / [alpha feedback](https://github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml) / [roadmap](docs/ROADMAP.md)

![NEKOWORK one-minute terminal demo](docs/assets/demo-terminal.svg)

## One Command. One Blocked Risk.

```bash
npx -y @ps-neko/nekowork@alpha auto "add OPENAI_API_KEY fallback for Codex auth"
```

Typical blocked-risk evidence:

```text
Risk: provider-auth / long-lived-secret
Codex verdict: request_changes
Human Gate: required
Ship ready: false
Applied: false

Blocked because NEKOWORK defaults to delegated CLI auth and rejects long-lived provider API key paths unless the human explicitly opts in.
```

That is the thesis: the autopilot can keep working before the boundary, but risky ship/apply decisions stay evidence-backed and human-controlled.

## 30-Second First Run

Use the current npm alpha for the fastest proof of the workflow:

```bash
npx -y @ps-neko/nekowork@alpha check
npx -y @ps-neko/nekowork@alpha auto "fix failing tests safely" --session first-auto
npx -y @ps-neko/nekowork@alpha report --session latest
```

Start with `auto` when you want NEKOWORK to keep going until report/gate. Use `build` when you want one build pass. Drop down to `work`, `verify`, and `ship` only when you need phase-level control.

Preview the route before running providers or writing session state:

```bash
npx -y @ps-neko/nekowork@alpha auto "fix failing tests safely" --dry-run
npx -y @ps-neko/nekowork@alpha build "fix this safely" --dry-run
```

Use a source checkout for local development:

```bash
node scripts/cli.js check
node scripts/cli.js auto "implement this safely" --session first-auto
node scripts/cli.js report --session latest
node scripts/cli.js gate status --session latest
```

Or use the decomposed beginner path directly:

```bash
node scripts/cli.js check
node scripts/cli.js run "implement this safely" --session first-run
node scripts/cli.js report --session first-run
node scripts/cli.js gate status --session first-run
```

The simple paths map to the evidence loop: `check = doctor --quick`, `build = auto routing plus mode presets over run`, `auto = bounded build/verify/repair/report before apply`, and `run = work -> verify -> ship`.

Use `build --dry-run` when you want to preview auto routing, mode, profile, workers, stages, and apply policy before running providers or writing session state. Use `build --explain` when you want the same routing rationale and evidence list after a real build.

To add generated NEKOWORK tool surfaces to another local repository:

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

The first screen of `REPORT.md` is the trust card: work produced, independent verification, Human Gate, ship readiness, apply state, and whether the target project was mutated.

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

## Apply Preview

Before `apply`, NEKOWORK expects the human to inspect the evidence surface:

```text
Session: first-work
Diff source: captured live-work diff
Files changed: 3
Verifier verdict: approve
Human gate: clear
Ship ready: true
Apply command: node scripts/cli.js apply --session first-work
```

`apply` still does not commit, push, publish, deploy, or create a PR. It only applies the verified `SHIP_READY` diff when gates are clear and the target worktree is clean.

## Evidence, Not Agent Count

| Trust question | NEKOWORK evidence |
|---|---|
| Did the tool record why ship was blocked? | `NO_SHIP`, `REPORT.md`, `gate-summary.json` |
| Did it keep apply human-controlled? | `auto` rejects `--apply`; `apply` is a separate command |
| Did it separate executor and verifier? | `work -> verify` with Codex review evidence |
| Did it block risky mode downgrades? | manifest-backed build mode safety order |
| Did it avoid long-lived provider API keys by default? | delegated CLI auth and API-key override guard |

## When To Choose NEKOWORK

| Use case | NEKOWORK fit |
|---|---|
| You want one command to keep working until report/gate | `auto` routes, builds, verifies, repairs, and stops before apply |
| You want one build pass with safe routing | `build` routes the task into safe mode presets |
| You want daily planning, TDD, debugging, and finish checks | use the `productivity` pack |
| You want team-style review before implementation | use the `team` pack; handoffs stay read-only |
| You need PR or release evidence | use `pr` or `release` before ship/apply |
| You need sensitive-change control | use `security` and keep Human Gate active |
| You need explicit apply instead of autopilot mutation | keep the default `report -> gate -> apply` path |

Use other AI development tools when they fit your preferred authoring flow. Use NEKOWORK when AI work needs to become verified, reportable, gated, and explicitly applied.

## Three Paths

Most users should start with the Autopilot path. The other paths are for explicit phase control. Legacy compatibility remains available without being the main product path.

1. Autopilot: `check -> auto -> report -> gate`
2. Controlled Build: `check -> build -> report -> gate`
3. Advanced: `ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply`

Legacy: `review` / `review-cycle`

## Why NEKOWORK

NEKOWORK is for teams that want AI-assisted development without making the agent catalog the product. The default path keeps local auth, inspectable handoffs, single-executor writes, independent Codex verification, and Human Gate decisions in front of risky ship/apply steps.

## Status

- Current repository version: `0.1.0-alpha.8` public alpha
- Current package name: `@ps-neko/nekowork`
- Published CLI name: `nekowork` (`harness` remains a legacy/internal alias)
- Current npm alpha: `@ps-neko/nekowork@0.1.0-alpha.8`
- Current npm alpha.8 status: published on 2026-05-08 under the `alpha` dist-tag
- Supported install path today: npm alpha, clone, submodule, or local repository integration
- Dist-tag note: use `@alpha` until a stable release; `latest` still points at the first alpha line
- Default mode: mock providers, no API keys, no provider CLI calls

Current local verification:

- `npm run lint`: pass
- `npm test`: 293 tests pass
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

## Starter Packs

Start with these five public packs. The full catalog remains available in [docs/CATALOG-PACKS.md](docs/CATALOG-PACKS.md) for advanced users.

| Pack | Adds | Use when |
|---|---|---|
| `core` | minimal verification runtime | first install or repo smoke |
| `builder` | safe build modes entrypoint | one-command build with verification and gates |
| `productivity` | planning, TDD, debugging, finish routines | daily AI-assisted development |
| `security` | auth/secrets/deploy risk prompts | sensitive changes |
| `release` | ship/no-ship evidence | pre-release checks |

## Quick Start Details

Requirements: Node.js 22+, npm, and git.

For a repository-pinned local demo:

```bash
git clone https://github.com/Ps-Neko/NEKOWORK.git harness
cd harness
npm ci
npm run demo:quick -- --cleanup
```

This creates a disposable target project and runs `doctor -> build -> report -> gate status`. It uses mock providers and does not call Claude, Codex, Gemini, or paid APIs.

To initialize another local repository with the published alpha:

```bash
cd /path/to/my-project
npx -y @ps-neko/nekowork@alpha init --profile developer --project-root .
```

For the fuller first-run guide, see [docs/QUICKSTART.md](docs/QUICKSTART.md).

For the trust and recovery model, see [Safety Guarantees](docs/SAFETY-GUARANTEES.md), [Failure Modes](docs/FAILURE-MODES.md), [Trust Model](docs/TRUST-MODEL.md), and [Why Not Autopilot](docs/WHY-NOT-AUTOPILOT.md).

To see the repository-based external project flow end to end:

```bash
npm run demo:external
```

To inspect small case-study targets, see [examples/trading-dashboard-mock](examples/trading-dashboard-mock), [examples/github-actions-hardening](examples/github-actions-hardening), [examples/quality-lifecycle-smoke](examples/quality-lifecycle-smoke), and [docs/case-studies](docs/case-studies). They demonstrate financial UI, CI workflow, quality lifecycle, npm package, auth parser, Python protocol library, environment configuration, and local diary app flows while still preserving Codex verification, Human Gate policy, and explicit apply control.

## Output Shape

```text
doctor ... OK
build workflow ... OK
report ... OK
gate status ... OK
Demo completed: verdict=approve_with_fixes, ship_ready=false, applied=false
```

Outputs are written under:

```text
.harness/state/sessions/<session-id>/handoffs/
.harness/state/sessions/<session-id>/REPORT.md
```

## Repository-Pinned Install

```bash
cd <target-project>
git submodule add https://github.com/Ps-Neko/NEKOWORK.git .harness-tool
node .harness-tool/scripts/portability/simulate-port.js . --profile developer --verbose
node .harness-tool/scripts/install-apply.js --profile developer --project-root .
node .harness-tool/scripts/cli.js check --project-root .
```

The NEKOWORK tool root stays in `.harness-tool/`. Session state, generated runtime files, and git work happen in the target project root.

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
- `build`: one-command builder wrapper with default `auto` routing, explicit `fast`, `safe`, `team`, `tdd`, `release`, and `--dry-run` preview
- `auto`: bounded autonomy wrapper that can repair fixable no-ship findings within budget, then report and stop before apply
- `report`: summarize session evidence into `REPORT.md` without project mutation
- `review`: run the legacy full Claude-led/Codex-reviewed workflow
- `review-cycle`: explicit compatibility alias for the legacy full review workflow
- `install --plan` / `install --apply`: project generated NEKOWORK tool surfaces

Advanced features such as `team-lite`, `ralph`, `wait`, instincts, cost tracking, and the Rust supervisor are documented in [docs/ADVANCED.md](docs/ADVANCED.md).

`plan` is recommended before `work` for larger changes. The current `run` command intentionally stays compact: it runs `work -> verify -> ship`, records acceptance criteria through `work`, and applies only when `--apply` is explicitly provided.

Use `build "<task>"` when NEKOWORK should be the single entrypoint. It defaults to `--mode auto`, classifies the task, selects `fast`, `safe`, `team`, `tdd`, or `release`, records build intelligence, and still uses one executor for writes, Codex verification before ship, and explicit apply only. The mode safety ordering is manifest-backed in `manifests/build-modes.json`. Use an explicit `--mode` when you need to override the router.

Risky explicit overrides are protected. For example, `build "change OAuth token validation" --mode fast` is blocked because auto routing recommends `safe`, and `build "prepare npm package publish release notes" --mode fast` is blocked because auto routing recommends the higher-safety `release` mode. Use the recommended mode or add `--force-mode` only when you intentionally accept that downgrade.

Use `auto "<task>"` when NEKOWORK should continue before the apply boundary. `auto` routes through the same build intelligence, runs `build`, repeats fixable no-ship work within `--level cautious|normal|aggressive` budgets, writes `auto-summary.json`, generates `REPORT.md`, and never accepts `--apply`.

Use `--profile quality` or `--profile security` on `work`, `verify`, and `run` when a task needs stronger evidence prompts. Add `--strict-quality` to `verify`, `run`, or `build` when missing evidence or acceptance coverage should become a fix-required verdict before ship.

Use official packs when choosing an install shape:

```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --pack productivity
node scripts/install-plan.js --pack builder
node scripts/install-plan.js --pack security --target codex --json
node scripts/install-plan.js --pack release
```

Packs are aliases over validated profiles. They add clearer product packaging without weakening the core gates. `productivity` is the shortest daily discipline pack: brainstorm, plan, TDD, debug, execute, verify, report, and finish over the same safe build loop. Advanced packs remain available in [docs/CATALOG-PACKS.md](docs/CATALOG-PACKS.md).

## Advanced Catalog

- Agents: 11
- Skills: 10
- Hooks: 5
- Modules: 7
- Profiles: `core`, `developer`, `builder`, `productivity`, `security`, `product`, `quality`, `frontend`, `testing`, `research`, `full`
- Full pack catalog: see [docs/CATALOG-PACKS.md](docs/CATALOG-PACKS.md)
- Tool targets: `claude`, `codex`, `cursor`, `gemini`, `opencode`

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
node scripts/cli.js build "builder smoke" --mode team --session build-smoke
node scripts/cli.js auto "fix failing tests safely" --level normal --dry-run
node scripts/cli.js report --session latest
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

`npm pack --dry-run --json` currently produces a package named like `ps-neko-nekowork-0.1.0-alpha.8.tgz`. It does not publish.

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md) - first run and common paths
- [docs/BUILD.md](docs/BUILD.md) - build command modes and invariants
- [docs/AUTONOMY.md](docs/AUTONOMY.md) - bounded autonomy, repair budgets, and the apply boundary
- [docs/AGENTIC-PATTERNS.md](docs/AGENTIC-PATTERNS.md) - 12 practical agentic harness patterns and NEKOWORK coverage
- [docs/PARALLEL-CANDIDATES.md](docs/PARALLEL-CANDIDATES.md) - planned isolated candidate writer contract
- [docs/PR-PREP.md](docs/PR-PREP.md) - planned PR prep artifact contract
- [docs/WHY-NEKOWORK.md](docs/WHY-NEKOWORK.md) - comparison and product positioning
- [docs/CATALOG-PACKS.md](docs/CATALOG-PACKS.md) - curated catalog, official packs, and case-study evidence
- [docs/PUBLISH-ALPHA.md](docs/PUBLISH-ALPHA.md) - public npm alpha release plan
- [docs/ROADMAP.md](docs/ROADMAP.md) - small alpha roadmap and non-goals
- [docs/FEEDBACK-TRIAGE.md](docs/FEEDBACK-TRIAGE.md) - alpha feedback classification and response guide
- [docs/INTERNAL-PROVIDER.md](docs/INTERNAL-PROVIDER.md) - private command adapter protocol
- [docs/DEMO.md](docs/DEMO.md) - sample command output and generated files
- [docs/DEMO-REPORT.md](docs/DEMO-REPORT.md) - readable session report UX
- [docs/EXTERNAL-RUN.md](docs/EXTERNAL-RUN.md) - external run evidence kit and public quote checklist
- [docs/EXAMPLE-PROJECT.md](docs/EXAMPLE-PROJECT.md) - repository-based external project demo
- [docs/case-studies](docs/case-studies) - real external project run evidence
- [examples/trading-dashboard-mock](examples/trading-dashboard-mock) - standalone financial UI mock target and case-study evidence
- [examples/quality-lifecycle-smoke](examples/quality-lifecycle-smoke) - standalone quality profile and strict-quality case-study evidence
- [docs/SECURITY.md](docs/SECURITY.md) - local-first auth and safety model
- [docs/ADVANCED.md](docs/ADVANCED.md) - advanced workflows and runtime features
- [docs/SETUP.md](docs/SETUP.md) - local contributor setup and live provider smoke
- [docs/PORTING.md](docs/PORTING.md) - using NEKOWORK in an external project
- [docs/RELEASE-READINESS.md](docs/RELEASE-READINESS.md) - release and publish gates
- [docs/RUNBOOK.md](docs/RUNBOOK.md) - operations guide
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system architecture
- [docs/PRODUCT-PRINCIPLES.md](docs/PRODUCT-PRINCIPLES.md) - product position, invariants, CLI phase semantics
- [docs/AI-DEVELOPMENT-LIFECYCLE.md](docs/AI-DEVELOPMENT-LIFECYCLE.md) - safe build modes, quality runtime, and disciplined lifecycle
- [docs/NAMING.md](docs/NAMING.md) - product, CLI, pack, and legacy alias naming contract
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
