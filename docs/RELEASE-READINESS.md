# Release Readiness

Status date: 2026-05-08

NEKOWORK is release-ready for local use, repository-based installation, and public npm alpha installation. The current repository candidate is `0.1.0-alpha.7`; the current public npm alpha remains `0.1.0-alpha.6` until the owner explicitly publishes alpha.7.

## Decision

- Decision: do not publish 0.0.3 to npm.
- Repository candidate: `0.1.0-alpha.7`.
- Public alpha: `0.1.0-alpha.6`, published with `--tag alpha`.
- `package.json` is set to `private: false` for the public alpha.
- The canonical repo is `Ps-Neko/NEKOWORK`.
- Current repository version is `0.1.0-alpha.7`; npm `@alpha` points at the published `0.1.0-alpha.6`.
- GitHub prerelease: `v0.1.0-alpha.6`.
- Required local provider auth is delegated CLI auth, not long-lived API keys.
- Core workflow invariant is Claude work -> Codex verification -> Human Gate.
- Risk classifier, acceptance criteria artifacts, and profile safety validation are part of the release gate.
- Remaining optional work is stable promotion and broader adoption evidence.
- Public package metadata is published as `@ps-neko/nekowork@alpha`.
- Dist-tag note: `latest` remains on the first alpha line; use `@alpha` until a stable release exists.
- See [PUBLISH-ALPHA.md](PUBLISH-ALPHA.md) for the public alpha checklist.

GitHub Release:

- https://github.com/Ps-Neko/NEKOWORK/releases/tag/v0.1.0-alpha.6

## 0.1.0-alpha.7 Candidate Scope

The `0.1.0-alpha.7` candidate scope is Build Intelligence reliability:

- `build` defaults to task-aware auto routing
- `build-intelligence` has a dedicated routing matrix test file
- `build --dry-run` and `build --explain` expose human-readable routing reasons
- `REPORT.md` includes a Build Intelligence section
- risky explicit mode overrides are blocked unless `--force-mode` is present
- apply remains explicit and evidence-gated

## 0.1.0-alpha.6 Release Scope

The `0.1.0-alpha.6` release scope is the safe builder mode runtime:

- `build` is the beginner all-in-one entrypoint
- build modes are documented: default `auto` routing plus `fast`, `safe`, `team`, `tdd`, and `release`
- `build` records `build-summary.json` and leaves `apply` explicit
- `team` mode runs read-only handoffs before the single executor
- `safe` and `tdd` modes strengthen verification and evidence requirements
- report and gate can inspect `--session latest`
- demos and quickstart now use `check -> build -> report -> gate`

Release exit criteria:

- required gates below pass locally
- `published-alpha-smoke` passes in GitHub Actions
- `npm pack --dry-run --json` contains only intended files
- changelog `0.1.0-alpha.6` entries match the release contents
- `latest` remains documented as non-stable; install examples continue to use `@alpha`

## Required Gates

Run these before a release tag or public package decision:

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
npm run security:hardening
npm pack --dry-run --json
npm publish --dry-run --access public --tag alpha
```

Current local verification after the decomposed workflow expansion:

- `npm run test:unit`: covered by full `npm test`
- `npm run validate:all`: pass
- `npm run lint`: pass
- `node scripts/sync-claude-md.js --check`: pass
- `node scripts/build-codemaps.js --check`: pass
- `npm test`: 277 tests pass
- `npm run demo:quick -- --cleanup`: pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass
- `npm publish --dry-run --access public --tag alpha`: pass
- `npm publish --access public --tag alpha`: `0.1.0-alpha.6` published
- `npm view @ps-neko/nekowork dist-tags version versions --json`: `alpha` points at `0.1.0-alpha.6`; `latest` remains `0.1.0-alpha.0`
- `npx -y @ps-neko/nekowork@alpha check`: passed for `0.1.0-alpha.6` with WARN summary from Gemini auth not checked
- GitHub Actions `published-alpha-smoke`: validates the fresh `npx @alpha` path against the published package

## Install Smoke

For the default developer profile:

```bash
npx -y @ps-neko/nekowork@alpha init --profile developer --project-root <target>
npx -y @ps-neko/nekowork@alpha check --project-root <target>
node scripts/install-plan.js --list --json
node scripts/install-plan.js --pack quality --json
node scripts/install-plan.js --profile developer --json
node scripts/portability/simulate-port.js <target> --profile developer --json
node scripts/cli.js init --profile developer --project-root <target>
node scripts/cli.js plan "release readiness smoke" --project-root <target>
node scripts/cli.js run "release readiness decomposed smoke" --project-root <target> --session release-run-smoke
```

The disposable install equivalent is:

```bash
npm run demo:external -- --cleanup
```

Expected target outputs:

- `.harness/install-state.json`
- `.harness/state/sessions/`
- `.harness/state/sessions/release-run-smoke/run-summary.json`
- `.claude/`
- `.codex/config.toml`
- `.cursor/hooks.json`
- `.gemini/GEMINI.md`
- `.opencode/config.json`

The one-command workflow equivalent is:

```bash
npm run demo:quick -- --cleanup
```

Expected quick-demo outputs:

- `.harness/state/sessions/<session>/work-summary.json`
- `.harness/state/sessions/<session>/verify-summary.json`
- `.harness/state/sessions/<session>/ship-summary.json`
- `.harness/state/sessions/<session>/run-summary.json`
- `.harness/state/sessions/<session>/build-summary.json`
- `.harness/state/sessions/<session>/REPORT.md`
- `.harness/state/sessions/<session>/report-summary.json`

## Full Builder Smoke

The install profile currently projects the runtime-required Claude/Codex surfaces. The full builder surface is verified separately:

```bash
HARNESS_PROJECT_ROOT=<target> node scripts/build-claude.js
HARNESS_PROJECT_ROOT=<target> node scripts/build-codex.js
HARNESS_PROJECT_ROOT=<target> node scripts/build-cursor.js
HARNESS_PROJECT_ROOT=<target> node scripts/build-gemini.js
HARNESS_PROJECT_ROOT=<target> node scripts/build-opencode.js
```

Expected target outputs:

- `.claude/`
- `.codex/config.toml`
- `.cursor/hooks.json`
- `.gemini/GEMINI.md`
- `.opencode/config.json`

## Not Included

- promotion to stable `latest`
- stable default install path; `latest` moves to a stable release later
- Internal LLM provider wiring
- Internal project rollout
- Automatic apply, commit, push, PR creation, release, or deploy
- Automatic promotion of learned instincts without human approval

## Public npm Checklist

Already completed for `0.1.0-alpha.6`. Repeat this checklist for the next public alpha:

1. Confirm the npm package name is still `@ps-neko/nekowork`.
2. Confirm the `nekowork` and `harness` binaries are still intentional.
3. Bump `package.json` to the next public alpha version only when publish is approved.
4. Run the required gates above.
5. Inspect `npm pack --dry-run --json` and confirm only intended files are included.
6. Confirm npm account access and 2FA readiness with `npm whoami`.
7. Confirm `private: false` in `package.json`.
8. Publish with `npm publish --access public --tag alpha`.
9. Smoke test from a fresh directory with `npx -y @ps-neko/nekowork@alpha check`.
10. Restore documentation from "future npm path" to "published npm path" where appropriate.
