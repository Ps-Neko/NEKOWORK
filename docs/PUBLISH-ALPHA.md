# Public Alpha Publish Record

NEKOWORK `0.0.3` stays a private/local alpha. The first npm release is the public alpha `0.1.0-alpha.0`; the current public alpha is `0.1.0-alpha.2`.

Do not publish from the `0.0.3` line.

The repository metadata has been advanced to `0.1.0-alpha.2` with `private: false`. The `0.1.0-alpha.0` publish succeeded on 2026-05-07. The `0.1.0-alpha.1` publish also succeeded on 2026-05-07. The `0.1.0-alpha.2` publish succeeded on 2026-05-08 and moved the `alpha` dist-tag forward.

The matching Git tag and GitHub prerelease are published as `v0.1.0-alpha.2`:

```text
https://github.com/Ps-Neko/NEKOWORK/releases/tag/v0.1.0-alpha.2
```

## Registry State

Checked on 2026-05-08:

```text
npm view @ps-neko/nekowork version --json
-> 0.1.0-alpha.0
```

The default version output follows `latest`, which is not the documented alpha install path.

The current alpha install path points at the release line:

```text
npm view @ps-neko/nekowork@alpha version --json
-> 0.1.0-alpha.2
```

Dist-tags:

```text
npm view @ps-neko/nekowork dist-tags --json
-> { "alpha": "0.1.0-alpha.2", "latest": "0.1.0-alpha.0" }
```

The publish package shape has been checked:

```text
npm publish --dry-run --access public --tag alpha
-> pass
```

The first alpha publish succeeded, and duplicate publish attempts are correctly blocked:

```text
npm publish --access public --tag alpha
-> E403 previously published versions: 0.1.0-alpha.0
```

The alpha update was published with the same `alpha` dist-tag:

```text
npm publish --access public --tag alpha
-> published 0.1.0-alpha.1
```

The second alpha update was also published with the same `alpha` dist-tag:

```text
npm publish --access public --tag alpha
-> published 0.1.0-alpha.2
```

After publish:

```text
npm view @ps-neko/nekowork@0.1.0-alpha.2 version --json
-> 0.1.0-alpha.2
```

`npx` smoke passed:

```text
npx -y @ps-neko/nekowork@alpha doctor --quick
-> WARN summary, 5 pass, 2 warn, 0 fail
```

The registry keeps `latest` on the first alpha line. Attempts to remove it after 2FA returned `E400 Bad Request`:

```text
npm dist-tag rm @ps-neko/nekowork latest
-> E400 Bad Request
```

Treat `latest` as an unavoidable alpha-line registry pointer for now. Do not promote it in docs as the stable path. When the first stable package is ready, publish or retag that stable version as `latest`.

## Release Shape

Published public alpha package:

```text
name: @ps-neko/nekowork
version: 0.1.0-alpha.2
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
- public alpha version `0.1.0-alpha.2`
- `private` removed or set to `false`
- publish tag is `alpha`, not `latest`

## Next Alpha Publish Checklist

Use this checklist for `0.1.0-alpha.3` or any later alpha. Do not run it until the owner explicitly approves the publish.

1. Confirm the candidate scope in [RELEASE-READINESS.md](RELEASE-READINESS.md).
2. Move the intended changelog entries from `Unreleased` to the new version heading.
3. Bump `package.json` to the approved alpha version.
4. Run the required gates below.
5. Inspect `npm pack --dry-run --json` and confirm issue templates, docs, examples, scripts, and assets are intentional.
6. Confirm `npm whoami` is the owner account.
7. Publish with `npm publish --access public --tag alpha`.
8. Verify `npm view @ps-neko/nekowork@alpha version --json` returns the new version.
9. Smoke test from a fresh directory with `npx -y @ps-neko/nekowork@alpha doctor --quick`.
10. Create and push `v<version>`.
11. Create a GitHub prerelease for `v<version>`.
12. Update release docs from candidate/pending language to published language.

Keep `latest` out of the public install path until a stable release exists.

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

- Move `latest` to the first stable release when the project is no longer alpha.
- Keep source/submodule install docs for users who want repository-pinned workflows.
