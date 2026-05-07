# Public Alpha Publish Record

NEKOWORK `0.0.3` stays a private/local alpha. The first npm release is the public alpha `0.1.0-alpha.0`.

Do not publish from the `0.0.3` line.

The repository metadata has been advanced to `0.1.0-alpha.0` with `private: false`. Public alpha publish succeeded on 2026-05-07.

## Registry State

Checked on 2026-05-07:

```text
npm view @ps-neko/nekowork version --json
-> 0.1.0-alpha.0
```

Dist-tags:

```text
npm view @ps-neko/nekowork dist-tags --json
-> { "alpha": "0.1.0-alpha.0", "latest": "0.1.0-alpha.0" }
```

The publish package shape has been checked:

```text
npm publish --dry-run --access public --tag alpha
-> pass
```

Actual publish succeeded, and a duplicate publish attempt is correctly blocked:

```text
npm publish --access public --tag alpha
-> E403 previously published versions: 0.1.0-alpha.0
```

`npx` smoke passed:

```text
npx -y @ps-neko/nekowork@alpha doctor --quick
-> WARN summary, 6 pass, 1 warn, 0 fail
```

The remaining npm registry cleanup is dist-tag only. Removing `latest` requires an npm 2FA browser challenge:

```bash
npm dist-tag rm @ps-neko/nekowork latest
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

## Published Commands

Published with:

```bash
npm publish --access public --tag alpha
```

Smoke test:

```bash
npx -y @ps-neko/nekowork@alpha doctor --quick
```

If the `harness` bin cannot run correctly through `npx`, do not promote the package.

## Post-Publish Work

- Remove the accidental `latest` dist-tag after npm 2FA approval.
- Keep source/submodule install docs for users who want repository-pinned workflows.
