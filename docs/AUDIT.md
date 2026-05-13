# Audit

Status date: 2026-05-13

This audit summarizes the current NEKOWORK state for the `0.1.0-alpha.10` alpha candidate. Public npm `@alpha` still points at `0.1.0-alpha.9` until alpha.10 is published.

## Current Status

| Area | Status | Notes |
|---|---|---|
| Package metadata | OK | repository version `@ps-neko/nekowork@0.1.0-alpha.10`, `agent.yaml` uses `name: nekowork`, `runtime_name: harness`, matching version, and `nekowork`/`harness` CLI bins |
| npm publish | PENDING | alpha.10 candidate prepared; publish requires final owner approval |
| Source install | OK | Clone, local checkout, and submodule workflows are documented |
| Public npm alpha | OK | `docs/PUBLISH-ALPHA.md` records alpha publishes through `0.1.0-alpha.9`; alpha.10 is the next prepared publish |
| CLI doctor/check | OK | `check`, `doctor`, `doctor --quick`, and `doctor --gemini-smoke` are available |
| Provider auth | OK | Local delegated CLI auth is the default path |
| Internal provider adapter | OK | `HARNESS_PROVIDER_OVERRIDE=internal` can call an explicit JSON command adapter without weakening gates |
| Catalog | OK | 14 official packs, 11 agents, 10 skills, 5 hooks, 7 modules, 36 components, 11 profiles |
| Multi-harness output | OK | Claude, Codex, Cursor, Gemini, and OpenCode builders are present |
| Quick demo | OK | `npm run demo:quick` verifies the shortest no-API `doctor -> build -> report -> gate status` path |
| Fresh npm alpha smoke | OK | CI runs `npx -y @ps-neko/nekowork@alpha check --json` from a disposable directory |
| Report UX | OK | `report` writes inspect-only `REPORT.md` and `report-summary.json` from session evidence |
| External demo | OK | `npm run demo:external` verifies a disposable target project flow |
| Third-party case studies | OK | `docs/case-studies/` records real public repository runs for npm package, auth boundary, Python protocol, and environment configuration targets, plus a user-provided local Diary app validation and checked-in parallel-candidate canonical fixture |
| Decomposed workflow | OK | `ask`, `team`, `work`, `verify`, `gate`, `ship`, `report`, `apply`, and `run` are available |
| Risk policy | OK | Shared classifier drives ask, routing traces, verify challenge/gates, and ship gate rechecks |
| Acceptance criteria | OK | `work` ensures every session has `acceptance-criteria.json` |
| Profile safety | OK | Manifest/catalog validators reject profiles that weaken core gates |
| Legacy compatibility | OK | `review` remains the full legacy loop; `review-cycle` is the explicit alias |
| Persistent wakeup | OK | `wait` resumes supported active sessions and blocks on `HUMAN_GATE` |
| Generated docs | OK | CODEMAP output is stable ASCII and reproducible |
| Tests | OK | Unit, integration, and e2e suites pass locally and in CI |
| PR Prep | OK | `pr-prep` generates local review artifacts without branch, commit, push, PR, apply, publish, or deploy actions |
| Release | PENDING | `v0.1.0-alpha.10` is prepared after alpha.10 publish; `v0.1.0-alpha.9` remains the latest public prerelease |

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
- `npm test`: 357 tests pass
- quick run demo: pass through `npm run demo:quick -- --cleanup`
- external project e2e smoke: pass through `npm test`
- `node scripts/sync-claude-md.js --check`: pass
- `node scripts/build-codemaps.js --check`: pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass
- `npm publish --dry-run --access public --tag alpha`: pass
- `npm publish --dry-run --access public --tag alpha`: pass for `0.1.0-alpha.10`
- `npm publish --access public --tag alpha`: pending owner approval for `0.1.0-alpha.10`
- `npm view @ps-neko/nekowork dist-tags version versions --json`: `alpha` points at `0.1.0-alpha.9`; `latest` remains `0.1.0-alpha.0`
- `npx -y @ps-neko/nekowork@alpha check`: pass with WARN summary, 6 pass, 1 warn, 0 fail for the published alpha.9 line

## Completed Work

- Local-first provider auth policy implemented and documented.
- `build` is the beginner entrypoint with default `auto` routing plus `fast`, `safe`, `team`, `tdd`, and `release` modes over the safe run/report/gate loop.
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
- `report` gives public alpha users a readable inspect-only session artifact without applying or mutating project files.
- Official packs expose curated install shapes without creating a second safety model.
- Checked-in example fixtures now cover financial UI, CI hardening, quality lifecycle, and parallel-candidate canonical promotion evidence flows.
- PR Prep now creates `PR_SUMMARY.md`, `RISK_NOTES.md`, `TEST_EVIDENCE.md`, `CHANGELOG_DRAFT.md`, `SHIP_DECISION.md`, and `pr-prep-summary.json` from existing session evidence without remote mutation.
- Third-party case studies record NEKOWORK runs against `sindresorhus/is-plain-obj`, `jshttp/basic-auth`, `python-hyper/h11`, and `motdotla/dotenv`; local generated-app evidence records the user-provided Diary app validation.
- Public npm alpha `0.1.0-alpha.9` is published and is the current registry `alpha` dist-tag; `0.1.0-alpha.10` is the repository candidate.

## Remaining Optional Work

| Item | Priority | Reason |
|---|---|---|
| Stable `latest` promotion | Medium | `alpha` is correct; npm keeps `latest` on the first alpha line for now, so move it to a stable version later |
| More third-party case studies | Low | Four public repo case studies exist; more frameworks can still improve adoption evidence later |
| More skill catalog expansion | Low | Catalog expansion should stay selective to preserve progressive disclosure |

## Explicit Non-Goals

- No public npm publish for `0.0.3`; public alpha starts at `0.1.0-alpha.0`.
- No automatic promotion of learned instincts without human confirmation.
- No tmux-first runtime import from OMC.
- No bulk import of large external skill catalogs.
- No magic-keyword auto activation.

## External Readiness Score

Current external readiness, excluding broader adoption evidence: **9.2 / 10**.

Main deductions:

- `latest` currently remains on the first alpha; docs still recommend `@alpha` until a stable release exists.
- Four independent real-world external project case studies exist so far, plus one user-provided local generated-app validation and one parallel-candidate canonical promotion fixture.
- Advanced surfaces exist but are intentionally secondary to the public decomposed workflow and install flow.
