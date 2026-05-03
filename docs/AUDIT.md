# Audit

Status date: 2026-05-04

This audit summarizes the current NEKOWORK state after the `v0.0.3` repository release. It replaces the older week-by-week scratch audit, which contained stale planning notes and encoding damage.

## Current Status

| Area | Status | Notes |
|---|---|---|
| Package metadata | OK | `@ps-neko/nekowork@0.0.3`, `private: true` |
| npm publish | Held | Public npm publishing is intentionally disabled |
| Source install | OK | Clone, local checkout, and submodule workflows are documented |
| CLI doctor | OK | `doctor`, `doctor --quick`, and `doctor --gemini-smoke` are available |
| Provider auth | OK | Local delegated CLI auth is the default path |
| Catalog | OK | 11 agents, 9 skills, 5 hooks, 7 modules, 35 components, 5 profiles |
| Multi-harness output | OK | Claude, Codex, Cursor, Gemini, and OpenCode builders are present |
| External demo | OK | `npm run demo:external` verifies a disposable target project flow |
| Generated docs | OK | CODEMAP output is stable ASCII and reproducible |
| Tests | OK | Unit, integration, and e2e suites pass locally and in CI |
| Release | OK | `v0.0.3` prerelease exists with tarball asset |

## Verification Gates

Run these before any release or public package decision:

```bash
node scripts/cli.js doctor
node scripts/cli.js doctor --quick --gemini-smoke
npm run lint
npm test
npm run demo:external -- --cleanup
npm audit --audit-level=moderate
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
npm pack --dry-run --json
```

Last known result for `v0.0.3`:

- `npm run lint`: pass
- `npm test`: 161 tests pass
- `npm run demo:external -- --cleanup`: pass
- `doctor --quick --gemini-smoke`: pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass

## Completed Work

- Local-first provider auth policy implemented and documented.
- API-key override warnings and guards are in place.
- Provider CLI path trust checks are in place.
- `--project-root` separates NEKOWORK tool root from target project root.
- `team-lite`, `ralph`, instincts, costs, and Rust runtime remain documented as advanced surfaces.
- Release docs, setup docs, runbook, quickstart, porting guide, and CODEMAP docs are readable for external users.
- The disposable external project demo proves the repository-based target-project flow end to end.

## Remaining Optional Work

| Item | Priority | Reason |
|---|---|---|
| Public npm publish decision | High, when desired | Converts repository alpha into an installable package |
| Real external project case study | Medium | Shows that porting works on a non-synthetic project |
| Internal provider adapter | Low until requested | Only useful for private infrastructure |
| More skill catalog expansion | Low | Should stay selective to preserve progressive disclosure |

## Explicit Non-Goals

- No public npm publish without owner approval.
- No automatic promotion of learned instincts without human confirmation.
- No tmux-first runtime import from OMC.
- No bulk import of large external skill catalogs.
- No magic-keyword auto activation.

## External Readiness Score

Current external readiness, excluding npm publish and third-party adoption evidence: **8.4 / 10**.

Main deductions:

- No public npm package yet.
- No independent real-world external project case study yet.
- Advanced surfaces exist but are intentionally secondary to the public `doctor`, `plan`, `review`, and `install` flow.
