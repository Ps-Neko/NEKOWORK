# Public Alpha Publish Record

> Updated 2026-06-07 for the package split + OIDC publish flow.

## Packages

NEKOWORK ships as **two packages** (see [HANDOFF-PACKAGE-SPLIT in the slim package](../../nekowork/HANDOFF-PACKAGE-SPLIT.md)):

| Package | Role | npm | Version |
|---|---|---|---|
| `@ps-neko/nekowork` | Public **slim verification gate** (4 verbs: `check` / `verify-pr` / `report` / `apply`) | **published** (`@alpha` dist-tag) | `0.2.0-alpha.10` |
| `@ps-neko/nekowork-harness` | Internal **legacy / power-user runtime** (`ask` / `plan` / `team` / `work` / `ship` / `build` / `auto` / ...) | **not published** (`private: true`) | `0.1.0-alpha.12` (repository version) |

Only the slim `@ps-neko/nekowork` is published. The harness runtime is internal — used from a **source checkout** of the repo, not installed from npm. Do not add `npm i -g @ps-neko/nekowork-harness` to any user-facing docs or CLI output.

## Current registry state

```text
npm view @ps-neko/nekowork dist-tags
-> { latest: '0.2.0-alpha.0', alpha: '0.2.0-alpha.10' }
```

- The documented install path is the `@alpha` dist-tag: `npx -y @ps-neko/nekowork@alpha`.
- `latest` is stuck on `0.2.0-alpha.0` (an early dist-tag rm returned `E400`). Treat `latest` as an unavoidable alpha-line pointer; do not promote it as the stable path. Retag `latest` only when a real stable release exists.

## Publish flow (OIDC — tokenless)

Publishing runs through the **`publish.yml` GitHub Actions workflow** using npm OIDC Trusted Publishing. No long-lived npm token and no interactive 2FA are involved — npm trusts the workflow's GitHub OIDC identity. (2FA only applies to manual `npm publish` from a laptop, which is **not** the path here.)

1. Bump `packages/nekowork/package.json` `version` to the next alpha (e.g. `0.2.0-alpha.10`).
2. Open a PR, get CI green, merge to `main`.
3. Trigger the publish workflow against `main`:
   ```bash
   gh workflow run publish.yml --repo Ps-Neko/NEKOWORK -f tag=alpha
   ```
   (or **Actions → publish → Run workflow**, input `tag=alpha`). The workflow is `workflow_dispatch`-only and never auto-fires.
4. Verify:
   ```bash
   npm view @ps-neko/nekowork@alpha version   # -> the new version
   ```
5. Fresh-user smoke from a throwaway git repo (the real external experience):
   ```bash
   npx -y @ps-neko/nekowork@alpha check
   npx -y @ps-neko/nekowork@alpha verify-pr   # run twice — the second run must not self-scan .nekowork/
   ```
6. Optionally create/push `v<version>` and a GitHub prerelease.

> The published `@alpha` may lag behind `main`. Pin an exact version (`@ps-neko/nekowork@0.2.0-alpha.10`) for reproducible behavior.

## Gates before a publish

Run from `packages/nekowork-cli` (the harness/source checkout):

```bash
npm run lint
npm test                     # nekowork-cli suite (imports the slim package)
npm audit --audit-level=moderate
```

And from `packages/nekowork` (the slim package being published):

```bash
npm test                     # slim unit suite
npm run smoke                # cli --version + verify-pr --help
npm pack --dry-run --json    # inspect shipped file list (scripts/, README.md, LICENSE)
```

CI must be green on `main` before triggering `publish.yml`.

## Historical record (pre-split, single `@ps-neko/nekowork` line)

Before the package split, `@ps-neko/nekowork` was the full runtime, published manually with `npm publish --access public --tag alpha`:

- `0.1.0-alpha.0` / `0.1.0-alpha.1` — 2026-05-07
- `0.1.0-alpha.2` … `0.1.0-alpha.8` — 2026-05-08
- `0.1.0-alpha.9` — 2026-05-13
- `0.1.0-alpha.10` / `0.1.0-alpha.11` — 2026-05-16
- `0.1.0-alpha.12` — 2026-05-26 (last single-package publish)

`0.0.3` and earlier stayed private/local and were never published. After the split, the slim line started at `0.2.0-alpha.0` (published via OIDC) and the harness package became private.
