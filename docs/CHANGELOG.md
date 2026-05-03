# CHANGELOG

> Format: Keep a Changelog. Versioning: SemVer.

## [Unreleased]

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
