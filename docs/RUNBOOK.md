# Runbook

This is the operator checklist for maintaining NEKOWORK.

## Daily Health

```bash
git status --short --branch
node scripts/cli.js doctor
npm run lint
npm test
npm audit --audit-level=moderate
```

`doctor` exits with failure if required freshness checks fail. Use `--quick` for a faster local environment check. Use `node scripts/cli.js doctor --quick --gemini-smoke` when Gemini live auth readiness matters for the release or machine being checked.

## Catalog Changes

When changing `agent.yaml`, `agents/`, `skills/`, `hooks/`, `rules/`, `manifests/`, or generated docs:

```bash
npm run lint
node scripts/repair.js
node scripts/sync-claude-md.js
node scripts/build-codemaps.js
node scripts/repair.js --check
node scripts/sync-claude-md.js --check
node scripts/build-codemaps.js --check
```

Then run:

```bash
npm test
```

Profile changes must also preserve the profile safety validator:

- every profile keeps the core modules
- no profile can disable Codex verification or Human Gate
- mutation policy cannot become parallel or unrestricted by profile default
- outbound network cannot become unrestricted by profile default

The validator runs through `npm run lint`.

## Project Install Smoke

Use a temporary target project:

```bash
node scripts/portability/simulate-port.js <target> --profile developer --verbose
node scripts/install-apply.js --profile developer --project-root <target>
node scripts/cli.js doctor --project-root <target> --quick
node scripts/cli.js plan "release smoke" --project-root <target> --session release-smoke
node scripts/cli.js run "release decomposed smoke" --project-root <target> --session release-run-smoke
```

Expected target outputs:

- `.harness/install-state.json`
- `.harness/state/sessions/release-smoke/`
- `.harness/state/sessions/release-run-smoke/run-summary.json`
- `.claude/`
- `.codex/config.toml`
- `.cursor/hooks.json`
- `.gemini/GEMINI.md`
- `.opencode/config.json`

## Release Gates

Before a tag, GitHub Release, or npm publish decision:

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

## Public npm Publish Checklist

Do not run this checklist unless public publish is explicitly approved.

1. Confirm `package.json#name` is `@ps-neko/nekowork`.
2. Confirm the `harness` binary name is still intentional.
3. Run all release gates.
4. Inspect `npm pack --dry-run --json`.
5. Confirm npm identity with `npm whoami`.
6. Confirm account 2FA readiness.
7. Remove `private: true` or set `private: false`.
8. Run `npm version patch|minor|major`.
9. Run `npm publish --access public`.
10. Update README, Quickstart, Changelog, and release notes from "future npm path" to "published npm path".

## GitHub Release Checklist

```bash
git tag -a v0.0.3 -m "HARNESS v0.0.3"
git push origin v0.0.3
npm pack --json
gh release create v0.0.3 ps-neko-nekowork-0.0.3.tgz --title "HARNESS v0.0.3" --prerelease --notes-file <notes.md>
```

Remove the local tarball after it is uploaded.

## Advanced Operations

Advanced workflows are documented in [ADVANCED.md](ADVANCED.md):

- `team-lite`
- `ralph`
- `wait`
- `instincts`
- cost tracking
- Rust runtime

## Troubleshooting

`doctor` reports API key warnings:

- Unset provider API keys for delegated local CLI auth.
- Keep `HARNESS_AUTH_ALLOW_ENV_OVERRIDE=1` only for intentional metered paths.

`repair --check` fails:

- Run `node scripts/repair.js`.
- Re-run `node scripts/repair.js --check`.

`sync-claude-md --check` fails:

- Run `node scripts/sync-claude-md.js`.

`build-codemaps --check` fails:

- Run `node scripts/build-codemaps.js`.

CI fails on security hardening:

- Check workflow permissions.
- Check job timeouts.
- Check MCP pins and HTTPS URLs.
- Check package-lock and dependency specs.
