# Audit

Status date: 2026-05-07

This audit summarizes the current NEKOWORK state after the `v0.0.3` repository release. It replaces the older week-by-week scratch audit, which contained stale planning notes and encoding damage.

## Current Status

| Area | Status | Notes |
|---|---|---|
| Package metadata | OK | `@ps-neko/nekowork@0.1.0-alpha.0`, `agent.yaml` uses `name: nekowork`, `runtime_name: harness` |
| npm publish | OK | `@ps-neko/nekowork@0.1.0-alpha.0` is published on npm |
| Source install | OK | Clone, local checkout, and submodule workflows are documented |
| Public npm alpha | OK | `docs/PUBLISH-ALPHA.md` records the `0.1.0-alpha.0` publish and npx smoke |
| CLI doctor | OK | `doctor`, `doctor --quick`, and `doctor --gemini-smoke` are available |
| Provider auth | OK | Local delegated CLI auth is the default path |
| Catalog | OK | 11 agents, 9 skills, 5 hooks, 7 modules, 35 components, 9 profiles |
| Multi-harness output | OK | Claude, Codex, Cursor, Gemini, and OpenCode builders are present |
| Quick demo | OK | `npm run demo:quick` verifies the shortest no-API `doctor -> run -> gate status` path |
| External demo | OK | `npm run demo:external` verifies a disposable target project flow |
| Third-party case study | OK | `docs/case-studies/SINDRESORHUS-IS-PLAIN-OBJ.md` records a real public repository run |
| Decomposed workflow | OK | `ask`, `team`, `work`, `verify`, `gate`, `ship`, `apply`, and `run` are available |
| Risk policy | OK | Shared classifier drives ask, routing traces, verify challenge/gates, and ship gate rechecks |
| Acceptance criteria | OK | `work` ensures every session has `acceptance-criteria.json` |
| Profile safety | OK | Manifest/catalog validators reject profiles that weaken core gates |
| Legacy compatibility | OK | `review` remains the full legacy loop; `review-cycle` is the explicit alias |
| Persistent wakeup | OK | `wait` resumes supported active sessions and blocks on `HUMAN_GATE` |
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
npm run demo:quick -- --cleanup
npm run demo:external -- --cleanup
npm audit --audit-level=moderate
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
npm pack --dry-run --json
```

Current local result for this working tree:

- `npm run test:unit`: covered by full `npm test`
- `npm run validate:all`: pass
- `npm run lint`: pass
- `npm test`: 238 tests pass
- quick run demo: pass through `npm run demo:quick -- --cleanup`
- external project e2e smoke: pass through `npm test`
- `node scripts/sync-claude-md.js --check`: pass
- `node scripts/build-codemaps.js --check`: pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass
- `npm publish --dry-run --access public --tag alpha`: pass
- `npm publish --access public --tag alpha`: published `0.1.0-alpha.0`; duplicate publish now blocks as expected
- `npx -y @ps-neko/nekowork@alpha doctor --quick`: pass with WARN summary from Gemini auth not checked

## Completed Work

- Local-first provider auth policy implemented and documented.
- API-key override warnings and guards are in place.
- Provider CLI path trust checks are in place.
- `--project-root` separates NEKOWORK tool root from target project root.
- Product principles and core invariants are documented.
- AI development lifecycle and quality-runtime positioning are documented.
- Standalone core invariants, CLI stages, and risk classifier docs are present.
- The decomposed workflow keeps multi-worker handoffs read-only, uses a single executor for work, requires Codex verification, and keeps Human Gate explicit.
- Acceptance criteria are now a required session artifact for work/verify/ship evidence.
- Review issue schema supports evidence-based findings with claim, evidence, required fix, confidence, and gate requirement.
- Financial and deploy-sensitive policy is gated by verify and rechecked by ship.
- Profile safety validation prevents profile defaults from disabling Codex review, Human Gate, or single-executor mutation policy.
- `run` wraps `work -> verify -> ship` without applying by default.
- `apply` requires verified `SHIP_READY` live-work diffs and refuses open gates.
- `team-lite`, `ralph`, `wait`, instincts, costs, and Rust runtime remain documented as advanced surfaces.
- Release docs, setup docs, runbook, quickstart, porting guide, and CODEMAP docs are readable for external users.
- The disposable external project demo proves the repository-based target-project flow end to end.
- The quick run demo proves the one-command no-API first experience.
- Checked-in example fixtures now cover financial UI, CI hardening, and quality lifecycle evidence flows.
- A third-party case study records a NEKOWORK run against `sindresorhus/is-plain-obj`.
- Public npm alpha `0.1.0-alpha.0` is published and smoke-tested through `npx`.

## Remaining Optional Work

| Item | Priority | Reason |
|---|---|---|
| Remove accidental `latest` dist-tag | High | `alpha` is correct, but npm also points `latest` at `0.1.0-alpha.0`; removing it requires npm 2FA approval |
| More third-party case studies | Medium | One public repo case study exists; more languages/frameworks would improve adoption evidence |
| Internal provider adapter | Low until requested | Only useful for private infrastructure |
| More skill catalog expansion | Low | Should stay selective to preserve progressive disclosure |

## Explicit Non-Goals

- No public npm publish for `0.0.3`; public alpha starts at `0.1.0-alpha.0`.
- No automatic promotion of learned instincts without human confirmation.
- No tmux-first runtime import from OMC.
- No bulk import of large external skill catalogs.
- No magic-keyword auto activation.

## External Readiness Score

Current external readiness, excluding broader adoption evidence: **9.0 / 10**.

Main deductions:

- `latest` currently points at the alpha and should be removed before treating the package as a stable default install.
- Only one independent real-world external project case study so far.
- Advanced surfaces exist but are intentionally secondary to the public decomposed workflow and install flow.
