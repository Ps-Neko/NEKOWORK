# CHANGELOG

> Format: Keep a Changelog. Versioning: SemVer.

## [Unreleased]

## [0.1.0-alpha.11] - 2026-05-16

### Added
- Add `nekowork verify-pr` 1.0 entrypoint: scans diff (working tree / staged / range / patch file) with deterministic risk rules, writes evidence to `.nekowork/evidence/`, decides verdict from rule findings + check availability, renders `REPORT.md`.
- Add 5 deterministic risk rules: Secret Fallback (killer), Auto-Apply-Commit-Push, Hardcoded Credential, Test-Or-Security-Disable, Package-Lockfile-Risk. All pass synthetic seed gate (recall ≥ 0.90, CRITICAL FP ≤ 0.10).
- Add `INSUFFICIENT_EVIDENCE` verdict: source change with no test command available no longer auto-passes — explicit "cannot verify" state per SCOPE-1.0 §7.
- Add `--comment-file <path>` option: emits GitHub PR comment markdown.
- Add `--ci-exit-soft` option: exits 0 for NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE so check is informational, not blocking.
- Add CI exit-code mapping (SCOPE-1.0 §8): ALLOW/ALLOW_WITH_WARNINGS=0, NEEDS_HUMAN_REVIEW/INSUFFICIENT_EVIDENCE=1, BLOCK=2.
- Add `scripts/lib/diff-parser.js`: unified diff parsing + working-tree git diff (incl. untracked synthesis) + patch-file loading.
- Add `scripts/lib/project-detector.js`: language / package manager / test / lint / typecheck / build / audit / CI / security file detection.
- Add `scripts/benchmark/rules.js` and `npm run bench:rules`: per-rule recall + FP measurement against fixture manifests, exits non-zero on 1.0 gate regression.
- Add `docs/examples/github-actions-verify-pr.yml`: drop-in workflow that posts the verdict as a PR comment and applies labels (`neko/needs-review`, `neko/no-evidence`, `neko/blocked`).
- Add `docs/SCOPE-1.0.md`: Phased Cut plan (Phase 0 / 1 / 2), risk rules, decision policy, fixture sourcing.
- Add `docs/VISION.md`: long-term "Verification-first AI development OS" vision separated from current 1.0 product surface.
- Add `tests/fixtures/secret-fallback`, `tests/fixtures/auto-apply-commit-push`, `tests/fixtures/hardcoded-credential`, `tests/fixtures/test-or-security-disable`, `tests/fixtures/package-lockfile-risk`, `tests/fixtures/oss-negatives` synthetic + real-OSS corpus with `manifest.json` and benchmark targets.

### Changed
- README hero aligned with verification-gate identity ("Don't merge AI code without verification" / "AI 가 만든 코드, 검증 없이는 통과시키지 마세요"). Codex repositioned as optional advisor, never controls verdict.
- README 30-second flow and "One Command. One Blocked Risk." promote `verify-pr` as the 1.0 entrypoint; `start` documented under Phased Cut.
- `docs/ADVANCED.md` gains Phased Cut banner with Phase 0 / 1 / 2 status table — 19 alpha-era commands remain functional but are scheduled for deprecation in 2.0 in favor of the verification-first surface.

### Preserved
- Codex review remains opt-in advisor only — never affects `decision.json.verdict`.
- No auto-commit, auto-push, auto-merge, or auto-apply behavior is introduced.
- Existing `check / start / report / apply` and the wider Advanced / Legacy surface continue to function for alpha users; deprecation begins in 0.3.x per SCOPE-1.0 Phase 1.

## [0.1.0-alpha.10] - 2026-05-14

### Added
- Add `nekowork start` as the beginner alias for the safe `build` entrypoint.
- Add `decision.json` as the shared machine-readable session decision surface.
- Add deterministic `preverify-summary.json` findings before Codex review for secret, auth, deploy, payment, env/config, permission, and destructive-data risks.
- Add `nekowork pr-prep` to generate review-ready local artifacts from an existing verified session.
- Add `PR_SUMMARY.md`, `RISK_NOTES.md`, `TEST_EVIDENCE.md`, `CHANGELOG_DRAFT.md`, `SHIP_DECISION.md`, and `pr-prep-summary.json` session evidence.
- Add `REPORT.md` PR Prep section and `examples/pr-prep-smoke` fixture.
- Add Beta Graduation Criteria burndown and alpha.10 evidence log in `docs/FEEDBACK-TRIAGE.md`.
- Promote `nekowork` as the canonical CLI verb prefix (`harness` retained as permanent alias).

### Changed
- Print verdict, reason, Human Gate state, ship readiness, and apply permission first for real `start`/`build` runs.
- Lock alpha.10 version consistency across `VERSION`, `package.json`, Provider Mode surface, and upstream artifact catalog.

### Preserved
- `pr-prep` does not create branches, commits, pushes, pull requests, applies, publishes, or deploys.
- Human remains responsible for commit, push, PR, release, publish, deploy, and apply decisions.

## [0.1.0-alpha.9] - 2026-05-13

### Added
- Add `auto --parallel-candidates N` preview for isolated candidate evidence before the canonical build path.
- Add `parallel-candidates.json` and `REPORT.md` Parallel Candidates evidence.
- Add candidate verification, arbiter selection, and canonical-candidate evidence for parallel candidates.
- Promote a clean selected parallel candidate through final Codex verification into the canonical ship-readiness path.
- Add `examples/parallel-candidates-canonical` as a self-contained alpha.9 evidence fixture.

### Changed
- Move parallel candidate canonical promotion from future preview language into the alpha.9 release surface.

## [0.1.0-alpha.8] - 2026-05-08

### Added
- Add bounded `auto` mode for apply-before-boundary autonomy: route, build, verify, repair fixable no-ship findings within budget, report, then stop before apply.
- Add `docs/AUTONOMY.md` and `auto-summary.json` report evidence for cautious, normal, and aggressive autonomy levels.
- Add `docs/PARALLEL-CANDIDATES.md` and `docs/PR-PREP.md` as the alpha.9/alpha.10 verified autopilot tracks.
- Add the `productivity` pack/profile for brainstorm, plan, TDD, debug, execute, verify, report, and finish routines over the safe build loop.
- Add verified productivity catalog pack aliases for `team`, `debugging`, `maintenance`, `pr`, and `catalog-plus`.
- Add manifest/schema-backed build mode safety policy in `manifests/build-modes.json`.
- Add mixed-intent Build Intelligence fixtures so release wording cannot hide security, data, or financial signals.
- Add the report Trust Card and a shorter 30-second first-run path.

### Changed
- Extract the `build` command surface from `scripts/cli.js` into a dedicated CLI command module.
- Expose bounded autonomy as a public `auto` command while keeping apply, commit, push, publish, and deploy explicit.
- Reposition the first screen and package metadata around "Verified Autopilot for AI code changes."
- Generalize `build` mode override protection from `safe`-only checks to risk-aware lower-safety downgrade checks.
- Validate build mode safety ordering through `validate:manifests`.

## [0.1.0-alpha.7] - 2026-05-08

### Added
- Add Build Intelligence v0 for `build --mode auto`, including task classification, safe preset routing, worker selection, acceptance criteria, mini plan, and self-check artifacts.
- Add `build --dry-run` to preview mode presets, stages, workers, and apply policy without creating session state.
- Add `build --explain` to print routing rationale and session evidence after a real build.
- Add `REPORT.md` Build Intelligence section for auto-routed sessions.
- Add dedicated Build Intelligence routing matrix tests.

### Changed
- Clarify the naming contract: NEKOWORK remains the product and `nekowork` the primary CLI, while `harness` is a legacy/internal alias.
- Reword public positioning around local-first AI development runtime and Safe Build Modes instead of promoting an OS name.
- Block risky explicit mode overrides unless `--force-mode` is provided.

## [0.1.0-alpha.6] - 2026-05-08

### Added
- Add the `build` command as a safe all-in-one builder wrapper with `fast`, `safe`, `team`, `tdd`, and `release` modes.
- Add the `builder` pack/profile for productivity-oriented setup without weakening Codex verification, Human Gate, or explicit apply.
- Add `build-summary.json` to report evidence and support `--session latest` for report/gate inspection.

### Changed
- Position NEKOWORK as an AI development runtime with Safe Build Modes, not only a verification harness.
- Make the one-minute demo and beginner path `build` centered.

## [0.1.0-alpha.5] - 2026-05-08

### Added
- Add release-surface version consistency coverage, bringing the suite to 253 tests.
- Publish public alpha `@ps-neko/nekowork@0.1.0-alpha.5` with the product-name CLI alias and sharpened npm metadata.

### Changed
- Align published alpha smoke, feedback templates, and demo docs around the beginner `check` command.
- Align `agent.yaml`, setup, porting, demo, and runbook release references with the package version.
- Document `npx @alpha init --project-root .` as the shortest target-project install path.

## [0.1.0-alpha.3] - 2026-05-08

### Added
- Add a `motdotla/dotenv` third-party case study for environment configuration and secret-loading boundary evidence.
- Add alpha feedback triage guidance and issue-template classification fields.
- Add beginner `check` and `init` CLI aliases for first-run health checks and install apply.
- Add Safety Guarantees, Failure Modes, Trust Model, and Why Not Autopilot docs.
- Add trust-doc and CLI alias tests, bringing the suite to 251 tests.

### Changed
- Rewrite the README first screen around unverified-change prevention, Human Gate, explicit apply, and no-surprise safety.
- Add a direct competitor choice table and clearer selective-catalog framing.

## [0.1.0-alpha.2] - 2026-05-08

### Added
- Add GitHub issue templates for alpha feedback and reproducible bug reports.
- Add CI coverage for a fresh `npx @ps-neko/nekowork@alpha doctor --quick` smoke against the published alpha package.
- Add an alpha.2 roadmap focused on release smoke evidence, demo assets, and external feedback.
- Add a static terminal SVG for the one-minute README demo.

### Changed
- Make the published alpha smoke workflow compare against the registry's current `@alpha` version instead of a hard-coded alpha string.

## [0.1.0-alpha.1] - 2026-05-07

### Added
- Add `report` to write inspect-only `REPORT.md` and `report-summary.json` from session evidence.
- Add official catalog packs as install aliases over safety-checked profiles.
- Add `docs/CATALOG-PACKS.md` to position NEKOWORK as a curated verification-loop catalog rather than a size-first agent pack.
- Add `npm run demo:quick` for the shortest no-API `doctor -> run -> report -> gate status` first experience.
- Add `docs/WHY-NEKOWORK.md` to clarify NEKOWORK's comparison against agent-pack, discipline, team, and autopilot tools.
- Add `docs/PUBLISH-ALPHA.md` and a third-party `sindresorhus/is-plain-obj` case study.
- Add a third-party `jshttp/basic-auth` security-profile case study.
- Add a third-party `python-hyper/h11` Python protocol case study.
- Add an opt-in internal provider command adapter.
- Add the focused `acceptance-coverage` quality evidence skill.
- Publish public alpha `@ps-neko/nekowork@0.1.0-alpha.1` with the updated adapter, case study, catalog evidence, report sample, and demo transcript.
- Add `npm run demo:external` to create a disposable target project and verify repository-based porting end to end.
- Add `docs/EXAMPLE-PROJECT.md` and e2e coverage for the external project demo.
- Add product principles and core invariants for the Claude work -> Codex verification -> Human Gate runtime.
- Add decomposed public workflow commands: `ask`, `team`, `work`, `verify`, `gate`, `ship`, `apply`, and `run`.
- Add `review-cycle` as an explicit compatibility alias for the legacy full review workflow.
- Add `ralph --engine run` so Ralph can repeat the decomposed `work -> verify -> ship` path.
- Add `wait` wakeup processing for supported active sessions with human-gate blocking and resume backoff.
- Add product, frontend, and testing install profiles.
- Add shared risk classifier, acceptance criteria artifact enforcement, and profile safety validation.
- Add standalone `CORE-INVARIANTS`, `CLI-STAGES`, and `RISK-CLASSIFIER` docs.
- Add trading dashboard mock example for financial UI gating.
- Add `examples/trading-dashboard-mock`, a standalone static case-study target with local mock-boundary checks.
- Add `examples/github-actions-hardening`, a standalone CI workflow hardening target with local YAML policy checks.
- Add `quality` profile and AI development lifecycle documentation for disciplined, evidence-based work.
- Add evidence-based review issue fields to the handoff schema.

### Changed
- Publish public alpha `@ps-neko/nekowork@0.1.0-alpha.0` and record `npx @alpha` smoke success.
- Record npm's first-alpha `latest` behavior and the `E400` response when trying to remove that tag.
- Rewrite `docs/AUDIT.md` and `docs/ARCHITECTURE.md` with clean public-facing ASCII content.
- Link the external project demo from README, Quickstart, Porting, Demo, and Release Readiness docs.
- Keep `review` as the legacy full cycle while making `run` the preferred decomposed wrapper for new automation.
- Make `team-lite` explicitly read-only handoff oriented.
- Accept explicit safety intent flags: `team --no-write`, `work --single-executor`, and `ship --require-clean-gates`.
- Recheck risk policy in `verify` and `ship` so financial/deploy-sensitive work cannot skip Human Gate.
- Clarify the beginner Golden Path, the advanced decomposed path, and the `run`/`apply` safety boundary.
- Refresh Quickstart, Advanced, Architecture, Release Readiness, Audit, Runbook, and generated CODEMAP docs for the expanded alpha surface.

### Security
- Preserve single-executor mutation, Codex verification, Human Gate, and explicit apply as non-bypassable workflow invariants.
- Refresh transitive dependency lockfile entries so `npm audit --audit-level=moderate` reports 0 vulnerabilities.

## [0.0.3] - 2026-05-03

### Changed
- Rewrite `scripts/build-codemaps.js` with stable ASCII output.
- Regenerate every `docs/CODEMAPS/*.md` file with readable headings, ASCII trees, and clean export tables.
- Add `doctor --gemini-smoke` so Gemini live auth can be explicitly included in the local health report.
- Rewrite `docs/PORTING.md` as a clean repository/submodule integration guide.
- Refresh README, Quickstart, Setup, Runbook, Demo, Advanced, and Release Readiness docs for the `0.0.3` repository-based release line.
- Bump package metadata to `0.0.3` and clean the package description.

### Security
- Keep `private: true`; public npm publish remains intentionally disabled.
- Keep delegated local CLI auth as the default provider path.

### Verified
- `npm run lint`
- `npm test`
- `node scripts/repair.js --check`
- `node scripts/sync-claude-md.js --check`
- `node scripts/build-codemaps.js --check`
- `node scripts/cli.js doctor`
- `node scripts/cli.js doctor --quick --gemini-smoke`
- `npm audit --audit-level=moderate`
- `npm pack --dry-run --json`

## [0.0.2] - 2026-04-29

### Changed
- Rename package metadata to `@ps-neko/nekowork` while keeping npm publishing disabled.
- Add public first-run documentation for source checkout, mock review, local CLI auth, and release gates.
- Add `harness doctor` for local environment, provider CLI/auth, API key override, and generated-output freshness checks.
- Add `docs/ADVANCED.md`, `docs/SECURITY.md`, and `docs/DEMO.md`.
- Move advanced runtime features out of the first-run path.
- Add external project `--project-root` support for install/apply, review, Ralph, team-lite, provider CLI resolution, and session state.
- Add provider CLI path hardening for Claude, Codex, and Gemini.
- Add security hardening checks for workflows, MCP pins, dependency specs, action refs, OIDC policy, and package lock presence.
- Add `team-lite` staged pipeline support.
- Add Rust runtime verification through `npm run verify:runtime`.

### Verified
- Local Claude CLI smoke passed with delegated Claude Code auth.
- Local Codex CLI smoke passed with ChatGPT login session.
- Local Gemini CLI smoke passed with Gemini CLI login session.
- Unit, integration, and e2e tests passed locally and in CI.
- GitHub Actions validate/review workflows passed.

## [0.0.1] - 2026-04-29

### Added
- Initial NEKOWORK/HARNESS catalog with agents, skills, hooks, rules, schemas, and multi-harness builders.
- `agent.yaml` as the single source catalog.
- Build projections for Claude Code, Codex CLI, Cursor, Gemini CLI, and OpenCode.
- Deterministic mock review flow with handoff persistence.
- Initial CLI verbs for install, validate, review, plan, sessions, costs, instincts, and version.
- Initial audit, architecture, and development notes.
