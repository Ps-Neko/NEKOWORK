# Catalog Packs

NEKOWORK intentionally keeps the catalog selective. Every agent, skill, hook, module, profile, and pack must preserve the verification loop:

```text
Claude work -> Codex verification -> report -> Human Gate -> explicit apply
```

Packs are public install aliases over validated profiles. They make the catalog easier to choose without creating a second safety model.

## Current Shape

```text
7 official packs
9 install profiles
7 modules
36 components
11 agents
10 skills
5 hooks
5 harness targets
6 case-study flows
245 tests
```

Harness targets:

```text
Claude, Codex, Cursor, Gemini, OpenCode
```

Case-study flows:

```text
financial UI mock
GitHub Actions hardening
quality lifecycle smoke
npm package boundary
auth parser boundary
Python protocol parser boundary
```

## Official Packs

| Pack | Profile | Best For | Representative Workflow |
|---|---|---|---|
| `core` | `core` | Minimal verification runtime | `doctor -> ask -> run -> report -> gate` |
| `quality` | `quality` | Disciplined development and evidence coverage | `ask --profile quality -> run --profile quality --strict-quality -> report` |
| `security` | `security` | Auth, secrets, permissions, deploy, financial, or data-sensitive changes | `ask --profile security -> run --profile security --secure --strict-quality -> report -> gate` |
| `frontend` | `frontend` | UI mockups, component review, accessibility-oriented checks | `ask --profile product -> team -> run -> report` |
| `testing` | `testing` | Regression planning and coverage-oriented handoffs | `plan -> work -> verify --profile quality --strict-quality -> report` |
| `release` | `developer` | Release readiness, changelog, and no-ship/ship evidence | `run -> report -> gate -> ship` |
| `enterprise` | `full` | Full stable catalog evaluation with all gates intact | `ask -> plan -> team -> work -> verify -> gate -> ship -> report -> apply` |

## Commands

```bash
node scripts/install-plan.js --list
node scripts/install-plan.js --pack security
node scripts/install-plan.js --pack quality --target claude --json
node scripts/install-apply.js --pack core --project-root <target>
```

`--pack` and `--profile` cannot be used together. A pack resolves to exactly one profile, and profile safety validation still rejects any default that weakens Codex verification, Human Gate, or single-executor mutation policy.

## Positioning

NEKOWORK does not try to be the largest catalog. It is a curated catalog for a reportable evidence pipeline:

```text
selective catalog
+ multi-surface projection
+ evidence report
+ Human Gate
+ explicit apply
= local-first AI development quality runtime
```
