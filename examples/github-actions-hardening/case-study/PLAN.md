# Plan

## Implementation

1. Add `.github/workflows/hardened-validate.yml`.
2. Use `push` and `pull_request` events only.
3. Set top-level `permissions: contents: read`.
4. Set explicit job permissions.
5. Use pinned action versions.
6. Disable checkout credential persistence.
7. Add a local `scripts/check.mjs` hardening validator.

## Acceptance Criteria

| ID | Criteria |
|---|---|
| AC-001 | Workflow validates on push and pull request only. |
| AC-002 | Top-level and job permissions are read-only. |
| AC-003 | Actions avoid floating refs. |
| AC-004 | No secrets, cloud credentials, deploy, or publish steps exist. |
| AC-005 | `npm test` validates the workflow boundary. |

## Human Gate

Human approval is required before claiming ship readiness because CI workflow changes can affect release, deploy, and repository trust boundaries.
