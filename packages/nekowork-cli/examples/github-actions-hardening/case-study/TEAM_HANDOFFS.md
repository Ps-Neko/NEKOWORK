# Team Handoffs

## Planner

Decided: Keep the workflow narrow: install and test only.

Rejected: Release, deploy, publish, cache mutation, and environment promotion.

Risks: CI workflows can accidentally grant token write scope or expose secrets.

Files: `.github/workflows/hardened-validate.yml`, `scripts/check.mjs`

Remaining: Verify permissions and action refs.

## Security

Decided: Use read-only permissions, no secrets, no cloud credentials, and no `pull_request_target`.

Rejected: Static cloud secrets, broad token scopes, floating action refs.

Risks: Future edits may add `id-token: write`, `contents: write`, or secret access.

Files: `.github/workflows/hardened-validate.yml`, `scripts/check.mjs`

Remaining: Human Gate stays required for deploy-sensitive workflow changes.

## Test

Decided: Use a local YAML parser check to validate the workflow contract.

Rejected: Live GitHub Actions execution for this small case-study fixture.

Risks: Static checks do not prove every marketplace action's internals.

Files: `scripts/check.mjs`, `package.json`

Remaining: Run `npm test`.
