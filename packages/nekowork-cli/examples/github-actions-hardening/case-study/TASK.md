# Task

Harden a GitHub Actions validation workflow without adding deploy or publish behavior.

## Scope

- Create a minimal CI workflow.
- Restrict GitHub token permissions.
- Pin action versions.
- Add a job timeout.
- Avoid secret, cloud credential, release, or deploy steps.

## Non-Goals

- No production deploy.
- No package publish.
- No cloud credential setup.
- No `pull_request_target`.
- No write-scoped token permissions.

## Recommended NEKOWORK Flow

```bash
node ../../scripts/cli.js ask "harden GitHub Actions validation workflow" --project-root . --session actions-hardening
node ../../scripts/cli.js plan "harden GitHub Actions validation workflow" --project-root . --session actions-hardening
node ../../scripts/cli.js team "harden GitHub Actions validation workflow" --workers planner,security,test --no-write --project-root . --session actions-hardening
node ../../scripts/cli.js work "implement hardened GitHub Actions validation workflow" --single-executor --project-root . --session actions-hardening
node ../../scripts/cli.js verify "verify hardened GitHub Actions validation workflow" --secure --project-root . --session actions-hardening
node ../../scripts/cli.js gate status --project-root . --session actions-hardening
```
