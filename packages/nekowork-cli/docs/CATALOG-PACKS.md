# Catalog Packs

NEKOWORK is not a large agent bundle. It is a verified productivity catalog: each pack exists to help users plan, build, debug, review, or release work while preserving the deterministic verdict (Codex advisory), Human Gate, and explicit apply.

```text
AI writes the diff -> deterministic risk rules + checks (Codex advisory) -> report -> Human Gate -> human merge decision
```

Packs are public install aliases over validated profiles. They make the catalog easier to choose without creating a second safety model. Productivity routines are packaged as verified workflows, not unchecked autonomy.

## Current Shape

```text
14 official packs
11 install profiles
7 modules
36 components
11 agents
11 skills
5 hooks
5 tool targets
10 case-study flows
533 tests
```

Tool targets:

```text
Claude, Codex, Cursor, Gemini, OpenCode
```

Case-study flows:

```text
financial UI mock
GitHub Actions hardening
quality lifecycle smoke
PR prep smoke
parallel candidate canonical promotion
npm package boundary
auth parser boundary
Python protocol parser boundary
environment configuration boundary
local diary app validation
```

## Official Packs

| Pack | Profile | Best For | Representative Workflow |
|---|---|---|---|
| `core` | `core` | Minimal verification runtime | `doctor -> ask -> run -> report -> gate` |
| `builder` | `builder` | Safe Build Modes entrypoint | `build "<task>" --mode auto|fast|safe|team|tdd|release -> report -> gate` |
| `productivity` | `productivity` | Brainstorm, plan, TDD, debug, execute, verify, report, and finish routines | `build "<task>" --mode auto -> report -> gate` |
| `team` | `developer` | Read-only role handoffs before one executor writes | `build "<task>" --mode team -> report -> gate` |
| `debugging` | `quality` | Failing tests, regressions, and root-cause isolation | `build "fix failing tests" --mode auto -> report -> gate` |
| `maintenance` | `developer` | Dependency upgrades, refactors, migrations, and cleanup | `build "<maintenance task>" --mode auto -> report -> gate` |
| `pr` | `developer` | Diff review, test evidence, changelog, risk notes, and PR readiness | `build "prepare PR evidence" --mode release -> report -> gate` |
| `catalog-plus` | `full` | Richest curated surface without weakening gates | `install-plan --pack catalog-plus -> build "<task>" --mode auto -> report -> gate` |
| `quality` | `quality` | Disciplined development and evidence coverage | `ask --profile quality -> run --profile quality --strict-quality -> report` |
| `security` | `security` | Auth, secrets, permissions, deploy, financial, or data-sensitive changes | `ask --profile security -> run --profile security --secure --strict-quality -> report -> gate` |
| `frontend` | `frontend` | UI mockups, component review, accessibility-oriented checks | `ask --profile product -> team -> run -> report` |
| `testing` | `testing` | Regression planning and coverage-oriented handoffs | `plan -> work -> verify --profile quality --strict-quality -> report` |
| `release` | `developer` | Release readiness, changelog, and no-ship/ship evidence | `run -> report -> gate -> ship` |
| `enterprise` | `full` | Full stable catalog evaluation with all gates intact | `ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply` |

## Commands

```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --pack builder
node scripts/install-plan.js --pack productivity
node scripts/install-plan.js --pack team
node scripts/install-plan.js --pack pr
node scripts/install-plan.js --pack security
node scripts/install-plan.js --pack quality --target claude --json
node scripts/install-apply.js --pack core --project-root <target>
```

`--pack` and `--profile` cannot be used together. A pack resolves to exactly one profile, and profile safety validation still rejects any default that weakens Codex verification, Human Gate, or single-executor mutation policy.

## Positioning

NEKOWORK is a curated catalog for a reportable evidence pipeline:

```text
selective verified productivity catalog
+ multi-surface projection
+ evidence report
+ Human Gate
+ explicit apply
= local-first AI development runtime with safe build modes
```
