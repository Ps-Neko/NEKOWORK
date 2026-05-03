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
- If a public package is requested later, rename to a controlled npm scope such as `@ps-neko/nekowork` or `@ps-neko/harness-cli` before publishing. Do not publish under `@harness/cli` unless the `@harness` npm scope is explicitly owned and approved.

## Required Gates

Run these before a release tag or public package decision:

```bash
npm run lint
npm test
npm audit --audit-level=moderate
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
npm run security:hardening
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
- Public package-name migration
- Internal LLM provider wiring
- Internal project rollout
- Automatic promotion of learned instincts without human approval
