# Public Alpha Publish Plan

NEKOWORK `0.0.3` stays a private/local alpha. The first npm release is prepared as the public alpha candidate `0.1.0-alpha.0`.

Do not publish from the `0.0.3` line.

The repository metadata has been advanced to `0.1.0-alpha.0` with `private: false`. Actual publish is still blocked until `npm whoami` succeeds for an owner account.

## Current Registry State

Checked on 2026-05-07:

```text
npm view @ps-neko/nekowork version --json
-> E404 Not Found
```

The package name is not publicly visible on npm from this environment. The machine is also not logged in:

```text
npm whoami
-> ENEEDAUTH
```

The publish package shape has been checked:

```text
npm publish --dry-run --access public --tag alpha
-> pass
```

Actual publish is still blocked by auth:

```text
npm publish --access public --tag alpha
-> ENEEDAUTH
```

## Release Shape

Prepared first public package:

```text
name: @ps-neko/nekowork
version: 0.1.0-alpha.0
dist-tag: alpha
bin: harness
```

The alpha tag matters. It prevents accidental default installation before the owner decides the public package should become the stable install path.

## Required Owner Decision

Before publishing, explicitly confirm:

- npm scope ownership for `@ps-neko`
- npm 2FA readiness
- package name `@ps-neko/nekowork`
- binary name `harness`
- public alpha version `0.1.0-alpha.0`
- `private` removed or set to `false`
- publish tag is `alpha`, not `latest`

## Required Gates

Run:

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
npm publish --dry-run --access public --tag alpha
```

Inspect the `npm pack --dry-run --json` file list before publishing.

## Publish Commands

Only after npm owner auth is active:

```bash
npm publish --access public --tag alpha
```

Then smoke test from a fresh temporary directory:

```bash
npx @ps-neko/nekowork@alpha doctor --quick
```

If the `harness` bin cannot run correctly through `npx`, do not promote the package.

## Post-Publish Work

- Add README npm install path.
- Add release notes.
- Tag the commit.
- Keep source/submodule install docs for users who want repository-pinned workflows.
