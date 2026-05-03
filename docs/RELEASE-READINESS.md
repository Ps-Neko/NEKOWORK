# Release Readiness

Status date: 2026-05-03

HARNESS / NEKOWORK is release-ready for local use and repository-based installation. Public npm publishing is intentionally disabled for the 0.0.2 line.

## Decision

- Decision: do not publish 0.0.2 to npm.
- `package.json` keeps `private: true`.
- The canonical repo is `Ps-Neko/NEKOWORK`.
- Current release track is `0.0.2`.
- Required local provider auth is delegated CLI auth, not long-lived API keys.
- Remaining optional work is internal project/provider integration on request.
- Public package metadata is prepared as `@ps-neko/nekowork`, but actual `npm publish` still requires an explicit approval step.

## Required Gates

Run these before a release tag or public package decision:

```bash
node scripts/cli.js doctor
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
npm run security:hardening
npm pack --dry-run --json
```

## Install Smoke

For the default developer profile:

```bash
node scripts/install-plan.js --list --json
node scripts/install-plan.js --profile developer --json
node scripts/portability/simulate-port.js <target> --profile developer --json
node scripts/install-apply.js --profile developer --project-root <target>
node scripts/cli.js plan "release readiness smoke" --project-root <target>
```

Expected target outputs:

- `.harness/install-state.json`
- `.harness/state/sessions/`
- `.claude/`
- `.codex/config.toml`
- `.cursor/hooks.json`
- `.gemini/GEMINI.md`
- `.opencode/config.json`

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
- Automatic promotion of learned instincts without human approval

## Public npm Checklist

Only run this checklist after the project owner explicitly approves public publishing:

1. Confirm the npm package name is still `@ps-neko/nekowork`.
2. Confirm the `harness` binary is still intentional.
3. Run the required gates above.
4. Inspect `npm pack --dry-run --json` and confirm only intended files are included.
5. Confirm npm account access and 2FA readiness with `npm whoami`.
6. Remove or set `private: false` in `package.json`.
7. Publish with `npm publish --access public`.
8. Restore documentation from "future npm path" to "published npm path" where appropriate.
