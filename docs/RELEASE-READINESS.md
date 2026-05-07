# Release Readiness

Status date: 2026-05-07

NEKOWORK / HARNESS is release-ready for local use and repository-based installation. Public npm publishing is intentionally disabled for the 0.0.3 line.

## Decision

- Decision: do not publish 0.0.3 to npm.
- Future public alpha path: prepare `0.1.0-alpha.0`, publish with `--tag alpha`, and keep `0.0.3` private.
- `package.json` keeps `private: true`.
- The canonical repo is `Ps-Neko/NEKOWORK`.
- Current release track is `0.0.3`.
- Required local provider auth is delegated CLI auth, not long-lived API keys.
- Core workflow invariant is Claude work -> Codex verification -> Human Gate.
- Risk classifier, acceptance criteria artifacts, and profile safety validation are part of the release gate.
- Remaining optional work is internal project/provider integration on request.
- Public package metadata is prepared as `@ps-neko/nekowork`, but actual `npm publish` still requires an explicit approval step.
- See [PUBLISH-ALPHA.md](PUBLISH-ALPHA.md) for the public alpha checklist.

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
```

Current local verification after the decomposed workflow expansion:

- `npm run test:unit`: covered by full `npm test`
- `npm run validate:all`: pass
- `npm run lint`: pass
- `node scripts/sync-claude-md.js --check`: pass
- `node scripts/build-codemaps.js --check`: pass
- `npm test`: 237 tests pass
- `npm run demo:quick -- --cleanup`: pass
- `npm audit --audit-level=moderate`: 0 vulnerabilities
- `npm pack --dry-run --json`: pass

## Install Smoke

For the default developer profile:

```bash
node scripts/install-plan.js --list --json
node scripts/install-plan.js --profile developer --json
node scripts/portability/simulate-port.js <target> --profile developer --json
node scripts/install-apply.js --profile developer --project-root <target>
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

- `npm publish`
- Public package publish execution
- Internal LLM provider wiring
- Internal project rollout
- Automatic apply, commit, push, PR creation, release, or deploy
- Automatic promotion of learned instincts without human approval

## Public npm Checklist

Only run this checklist after the project owner explicitly approves public publishing:

1. Confirm the npm package name is still `@ps-neko/nekowork`.
2. Confirm the `harness` binary is still intentional.
3. Bump to a new public alpha version such as `0.1.0-alpha.0`.
4. Run the required gates above.
5. Inspect `npm pack --dry-run --json` and confirm only intended files are included.
6. Confirm npm account access and 2FA readiness with `npm whoami`.
7. Remove or set `private: false` in `package.json`.
8. Publish with `npm publish --access public --tag alpha`.
9. Smoke test from a fresh directory with `npx @ps-neko/nekowork@alpha doctor --quick`.
10. Restore documentation from "future npm path" to "published npm path" where appropriate.
