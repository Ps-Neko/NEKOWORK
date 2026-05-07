# GitHub Actions Hardening Example

This example shows how NEKOWORK handles deploy-sensitive CI workflow work.

The checked-in standalone target project lives at:

```text
examples/github-actions-hardening/
```

It includes a hardened validation workflow, a local YAML-based hardening check, and case-study artifacts under `case-study/`.

## Request

```text
Harden a GitHub Actions validation workflow without adding deploy or publish behavior.
```

## Recommended Flow

```bash
node scripts/cli.js ask "harden GitHub Actions validation workflow" --session actions-hardening
node scripts/cli.js plan "harden GitHub Actions validation workflow" --session actions-hardening
node scripts/cli.js team "harden GitHub Actions validation workflow" --workers planner,security,test --no-write --session actions-hardening
node scripts/cli.js work "implement hardened GitHub Actions validation workflow" --single-executor --session actions-hardening
node scripts/cli.js verify "verify hardened GitHub Actions validation workflow" --secure --session actions-hardening
node scripts/cli.js gate status --session actions-hardening
```

## Expected Policy Behavior

The task should classify as:

```text
risk=high
tags=deploy
requiresCodexChallenge=true
requiresHumanGate=true
```

That means:

- `ask` confirms deploy/publish/cloud credentials are out of scope.
- `team` remains read-only.
- `work` uses one executor and records acceptance criteria.
- `verify --secure` runs Codex review and Codex challenge.
- `ship` stays blocked until the human explicitly approves or blocks.

## Local Evidence

Inside the example project:

```bash
npm test
```

Expected output:

```text
github-actions-hardening checks passed
```

The local check verifies:

- no `pull_request_target`
- no package publish
- no static secrets
- no cloud credential setup
- read-only permissions
- pinned non-floating action refs
- bounded job timeout

## Example Gate Resolution

Approve only after confirming the workflow remains validation-only:

```bash
node scripts/cli.js gate approve --session actions-hardening --reason "Confirmed validation-only hardened workflow."
node scripts/cli.js ship "prepare GitHub Actions hardening ship readiness" --require-clean-gates --session actions-hardening
```

If deploy, publish, or broad permission behavior appears:

```bash
node scripts/cli.js gate block --session actions-hardening --reason "Workflow hardening boundary is not proven."
```
