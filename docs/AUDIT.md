# Audit

Status date: 2026-05-07

This audit summarizes the current NEKOWORK state after preparing the `0.1.0-alpha.1` alpha candidate. It replaces the older week-by-week scratch audit, which contained stale planning notes and encoding damage.

## Current Status

| Area | Status | Notes |
|---|---|---|
| Package metadata | OK | `@ps-neko/nekowork@0.1.0-alpha.1`, `agent.yaml` uses `name: nekowork`, `runtime_name: harness` |
| npm publish | WARN | `@ps-neko/nekowork@0.1.0-alpha.0` is published; `0.1.0-alpha.1` publish is prepared but requires owner OTP/web auth |
| Source install | OK | Clone, local checkout, and submodule workflows are documented |
| Public npm alpha | OK | `docs/PUBLISH-ALPHA.md` records the first alpha publish and the pending `0.1.0-alpha.1` publish attempt |
| CLI doctor | OK | `doctor`, `doctor --quick`, and `doctor --gemini-smoke` are available |
| Provider auth | OK | Local delegated CLI auth is the default path |
| Internal provider adapter | OK | `HARNESS_PROVIDER_OVERRIDE=internal` can call an explicit JSON command adapter without weakening gates |
| Catalog | OK | 11 agents, 10 skills, 5 hooks, 7 modules, 36 components, 9 profiles |
| Multi-harness output | OK | Claude, Codex, Cursor, Gemini, and OpenCode builders are present |
| Quick demo | OK | `npm run demo:quick` verifies the shortest no-API `doctor -> run -> gate status` path |
| External demo | OK | `npm run demo:external` verifies a disposable target project flow |
| Third-party case studies | OK | `docs/case-studies/` records real public repository runs for npm package, auth boundary, and Python protocol targets |
| Decomposed workflow | OK | `ask`, `team`, `work`, `verify`, `gate`, `ship`, `apply`, and `run` are available |
| Risk policy | OK | Shared classifier drives ask, routing traces, verify challenge/gates, and ship gate rechecks |
| Acceptance criteria | OK | `work` ensures every session has `acceptance-criteria.json` |
| Profile safety | OK | Manifest/catalog validators reject profiles that weaken core gates |
| Legacy compatibility | OK | `review` remains the full legacy loop; `review-cycle` is the explicit alias |
| Persistent wakeup | OK | `wait` resumes supported active sessions and blocks on `HUMAN_GATE` |
| Generated docs | OK | CODEMAP output is stable ASCII and reproducible |
| Tests | OK | Unit, integration, and e2e suites pass locally and in CI |
| Release | WARN | `v0.1.0-alpha.0` prerelease exists; `v0.1.0-alpha.1` should be tagged after npm publish succeeds |

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
- `npm test`: 243 tests pass
- quick run demo: pass through `npm run demo:quick -- --cleanup`
- external project e2e smoke: pass through `npm test`
- `node scripts/sync-claude-md.js --check`: pass
- `node scripts/build-codemaps.js --check`: pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass
- `npm publish --dry-run --access public --tag alpha`: pass
- `npm publish --access public --tag alpha`: `0.1.0-alpha.1` blocked by npm `EOTP` pending owner OTP/web auth
- `npx -y @ps-neko/nekowork@alpha doctor --quick`: previously passed for `0.1.0-alpha.0` with WARN summary from Gemini auth not checked

## Completed Work

- Local-first provider auth policy implemented and documented.
- Internal provider command adapter implemented and documented without bypassing verification, Human Gate, or apply controls.
- `acceptance-coverage` skill added as a focused quality evidence helper.
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
- Third-party case studies record NEKOWORK runs against `sindresorhus/is-plain-obj`, `jshttp/basic-auth`, and `python-hyper/h11`.
- Public npm alpha `0.1.0-alpha.0` is published and smoke-tested through `npx`; `0.1.0-alpha.1` is prepared for owner-authenticated publish.

## Remaining Optional Work

| Item | Priority | Reason |
|---|---|---|
| Publish `0.1.0-alpha.1` | High | Package is prepared and dry-run passes, but npm requires owner OTP/web auth |
| Stable `latest` promotion | Medium | `alpha` is correct; npm also points `latest` at the only published version and rejected removal with `E400`, so move it to a stable version later |
| More third-party case studies | Low | Three public repo case studies exist; more frameworks can still improve adoption evidence later |
| More skill catalog expansion | Low | Catalog expansion should stay selective to preserve progressive disclosure |

## Explicit Non-Goals

- No public npm publish for `0.0.3`; public alpha starts at `0.1.0-alpha.0`.
- No automatic promotion of learned instincts without human confirmation.
- No tmux-first runtime import from OMC.
- No bulk import of large external skill catalogs.
- No magic-keyword auto activation.

## External Readiness Score

Current external readiness, excluding broader adoption evidence: **9.1 / 10**.

Main deductions:

- `latest` currently points at the alpha because it is the only published version; docs still recommend `@alpha` until a stable release exists.
- `0.1.0-alpha.1` publish requires owner OTP/web auth.
- Three independent real-world external project case studies exist so far.
- Advanced surfaces exist but are intentionally secondary to the public decomposed workflow and install flow.
