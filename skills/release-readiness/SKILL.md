---
name: release-readiness
description: "Prepare a HARNESS local release candidate by running validation gates, install smoke, builder smoke, and package dry-run checks."
origin: harness-core
level: 2
prerequisites: [security-hardening]
conflicts: []
auto_inject_keywords: [release, readiness, smoke, package, publish]
tags: [release, validation, smoke]
---

# release-readiness

Use this skill before tagging a release, changing package metadata, changing install outputs, or deciding whether a package is publishable.

## Required Gates

Run:

```bash
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

Use a temporary target project and verify install-plan, portability preflight, install-apply, and a plan-only review path.

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

## Publish Guard

Do not run `npm publish` as part of this skill. Publishing is a separate explicit decision.

If preparing for public npm, confirm:

- package name uses a controlled scope
- `private` remains true until the publish task
- `npm pack --dry-run --json` contains only intended files
- README and PORTING examples match the chosen package name
