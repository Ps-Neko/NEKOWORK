# Handoff — `@ps-neko/nekowork` Package Split

> Branch: `feat/package-split` · Started: 2026-05-27 · Status: **Phase A skeleton done, real refactor pending**
> Plan source: [`docs/plans/2026-05-27-installer-package-split.md`](../../docs/plans/2026-05-27-installer-package-split.md)

## What's done (this branch)

```
packages/nekowork/
├── package.json     # slim metadata, 4-verb surface, version 0.2.0-alpha.0
├── README.md        # slim-positioned README, links to harness
├── HANDOFF-PACKAGE-SPLIT.md  # this file
└── scripts/cli.js   # thin guard layer (~75 lines)
                     # - allows: check / verify-pr / report / apply
                     # - rejects: ask / plan / team / work / ship / build / auto / ...
                     # - delegates allowed verbs to ../nekowork-cli/scripts/cli.js
                     #   via execFileSync (relative path)
```

Verified working (smoke):
- `node scripts/cli.js --version` → prints `0.2.0-alpha.0`
- `node scripts/cli.js` (no args) → prints help with the 4 verbs
- `node scripts/cli.js team` → rejects with `nekowork-harness team` redirect
- `node scripts/cli.js verify-pr ...` → forwards to nekowork-cli (delegation path verified)

The delegation path returned `ERR_MODULE_NOT_FOUND: yaml` on `check` because
the monorepo isn't bootstrapped (`pnpm install` hasn't been run in this
checkout). The same error reproduces when running `nekowork-cli` directly, so
it's a workspace dependency issue, not a Phase A skeleton bug. Bootstrap with
`pnpm install` and both paths work.

## What is NOT done — the real refactor

The current skeleton **cannot be published to npm as a standalone package**.
It depends on `../nekowork-cli/scripts/cli.js` via a relative filesystem
path that won't exist in an installed npm tarball.

To publish `@ps-neko/nekowork` independently, do the moves below.

### File moves (canonical list)

Copy these from `packages/nekowork-cli/` into `packages/nekowork/`:

| Source | Notes |
|---|---|
| `scripts/orchestrators/verify-pr.js` | Verify-pr orchestrator (468 lines) |
| `scripts/orchestrators/apply.js` | Apply orchestrator (227 lines) |
| `scripts/orchestrators/report.js` | Report renderer |
| `scripts/lib/decision.js` | Decision schema + builder (325 lines) |
| `scripts/lib/diff-parser.js` | Git diff parser |
| `scripts/lib/severity.js` | Finding → severity classifier |
| `scripts/lib/rules/secret-fallback.js` | Killer rule + env-or-empty-string pattern |
| `scripts/lib/rules/auto-apply-commit-push.js` | NEKOWORK-identity rule |
| `scripts/lib/rules/hardcoded-credential.js` | Provider credential signatures |
| `scripts/lib/rules/test-or-security-disable.js` | Bypass detector |
| `scripts/lib/rules/package-lockfile-risk.js` | Supply-chain rule |
| `scripts/lib/rules/_helpers.js` | Shared regex scanner factory |
| `scripts/lib/project-detector.js` | Project type sniffer |
| `scripts/lib/check-environment.js` | `check` verb entry (if not already in cli.js dispatch) |
| `schemas/decision.schema.json` | (and any other schemas verify-pr reads) |
| `tests/fixtures/secret-fallback/**` | Rule corpora — keep for bench:rules |
| `tests/fixtures/auto-apply-commit-push/**` | ↑ |
| `tests/fixtures/hardcoded-credential/**` | ↑ |
| `tests/fixtures/test-or-security-disable/**` | ↑ |
| `tests/fixtures/package-lockfile-risk/**` | ↑ |
| `tests/fixtures/oss-negatives/**` | Shared OSS negatives |
| `tests/unit/secret-fallback.test.js` | Rule unit tests |
| `tests/unit/auto-apply-commit-push.test.js` | ↑ |
| `tests/unit/hardcoded-credential.test.js` | ↑ |
| `tests/unit/test-or-security-disable.test.js` | ↑ |
| `tests/unit/package-lockfile-risk.test.js` | ↑ |
| `tests/unit/decision.test.js` | Decision engine tests |
| `tests/unit/risk-classifier.test.js` | ↑ |
| `tests/unit/check-version.test.js` | (if it covers verify-pr inputs) |
| `scripts/benchmark/rules.js` | OSS-aware benchmark (already patched) |
| `scripts/benchmark/scrape-oss-positives.js` | OSS scraper |
| `scripts/benchmark/verify-candidates.js` | OSS verifier |
| `docs/QUICKSTART.md, SCOPE-1.0.md, INTEGRATION.md, BENCHMARK.md, LIVE-AI-CAPTURE.md` | Stay with nekowork (1.0 docs) |

### After moves

1. **Trim `scripts/cli.js`** to a real dispatch (remove the execFileSync
   delegation). The 4-verb case blocks need to be lifted out of nekowork-cli's
   1811-line cli.js into the new package. Estimate: 3-4 hours.
2. **Update imports.** Every moved file's `import` paths need to resolve
   inside the new package. Estimate: 1-2 hours (relatively mechanical).
3. **Add `"dependencies"`** for what `verify-pr` actually needs at runtime
   (`@modelcontextprotocol/sdk`, `@napi-rs/keyring`, `ajv`, `ajv-formats`,
   `yaml`). Check `package.json` of nekowork-cli for the canonical list.
4. **Re-publish bench:rules.** `npm run bench:rules` must work and produce the
   same numbers (73/74 recall, 0/47 FP) as on `main`.
5. **Update root `pnpm-workspace.yaml`.** No change needed for new package —
   already covered by `packages/*` glob.

### Concurrent: `@ps-neko/nekowork-harness`

The old `@ps-neko/nekowork-cli` doesn't disappear. Two paths:

- **Rename** `packages/nekowork-cli/` → `packages/nekowork-harness/`, update
  the `name` field to `@ps-neko/nekowork-harness`. Bin: `nekowork-harness`.
  Files: keep agents/skills/hooks/manifests/packs as-is. Old name printed a
  deprecation notice for 1.x.
- **Or** add a `packages/nekowork-cli/` shim package that just emits a
  deprecation message and re-installs nekowork-harness.

Decision deferred to the person executing.

### Estimated total

| Step | Hours |
|---|---:|
| File copies (1-time) | 1 |
| cli.js trim + 4-verb dispatch in new package | 4 |
| Import path updates | 2 |
| Dependency declaration | 0.5 |
| Tests pass (`npm test`) | 3 |
| Benchmark pass (`npm run bench:rules`) | 0.5 |
| nekowork-cli rename + deprecation notice | 2 |
| Smoke test on a real PR diff | 1 |
| Publish dry-run + actual publish | 2 |
| **Total** | **16 hours (2 work days)** |

## Open decisions

These need a human sign-off before execution:

1. **Move vs copy.** Move is cleaner (single source of truth) but risks
   breakage during the move. Copy + delete later is safer but creates
   short-term duplication. Recommend: copy, ship 0.2.0-alpha.0 with both, then
   delete from nekowork-harness in 0.2.0-alpha.1.
2. **Old npm name.** Does `@ps-neko/nekowork-cli` keep being published as a
   redirect for ≥ 1 alpha cycle, or do we hard-cut?
3. **Catalog ownership.** Should `agents/`, `skills/`, `hooks/`, `manifests/`,
   `packs/` move to `@ps-neko/nekowork-harness` (per plan §3) or to a third
   `@ps-neko/nekowork-catalog` package? The plan says harness; revisit only
   if catalog grows to >50% of harness LOC.
4. **CI matrix.** Two packages now. `pnpm -r test` covers both, but CI yaml
   probably needs an explicit step per package. Update
   `.github/workflows/harness-validate.yml` accordingly.

## How to resume

```bash
git checkout feat/package-split
# Pick up at "File moves" above. Start with verify-pr.js + lib/decision.js
# + lib/rules/*.js. Run `node scripts/cli.js verify-pr --help` after each
# group of moves to confirm nothing broke (cli.js dispatch still delegates
# until you trim it).
```

Or hand off to claude/codex/cursor: paste this file as context and ask for
the file-move PR.
