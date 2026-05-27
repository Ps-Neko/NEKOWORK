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

## Open decisions — resolved 2026-05-27

Decisions taken on this PR's merge (`feat/package-split` → `main`). Each is a
default that can be overturned by a follow-up PR if Phase B execution finds a
better trade-off — Phase A skeleton commits to none of them.

### 1. Move vs Copy → **COPY** during transition

`0.2.0-alpha.0` ships *both* packages with overlapping code (verify-pr +
rules + fixtures + lib/decision in both `@ps-neko/nekowork-cli` and
`@ps-neko/nekowork`). In `0.2.0-alpha.1` (or the first 1.0 candidate),
delete the duplicated files from `@ps-neko/nekowork-harness` (the renamed
`nekowork-cli`).

Why: easier rollback if the slim package smoke-fails on a real PR diff. The
window with duplication is one alpha cycle and we control the SHA of both
packages on the same monorepo commit.

### 2. Old npm name `@ps-neko/nekowork-cli` → **deprecate, keep publishing 1 alpha cycle**

`@ps-neko/nekowork-cli@0.2.0-alpha.0` ships as a slim re-export package
that prints a deprecation notice on every CLI invocation:

```
@ps-neko/nekowork-cli is deprecated. For the verification gate:
  npm i -g @ps-neko/nekowork
For the legacy / harness surface (install, ask, plan, team, work, ship, ...):
  npm i -g @ps-neko/nekowork-harness
```

After one alpha cycle (≈ 2 weeks), `@ps-neko/nekowork-cli` is npm-deprecated
(`npm deprecate`) so `npm install` shows a warning and future-installs are
discouraged. The published versions remain on the registry.

Why: existing alpha testers (npm install records) shouldn't break suddenly.
Hard-cut is OK only if we can confirm install count is < ~5 — checking npm
download stats before alpha.1 is a Phase B step.

### 3. Catalog ownership (`agents/`, `skills/`, `hooks/`, `manifests/`, `packs/`) → **`@ps-neko/nekowork-harness`** (one package)

Per [`docs/plans/2026-05-27-installer-package-split.md`](../../docs/plans/2026-05-27-installer-package-split.md)
§3. The catalog stays with the harness package because it is consumed *only*
by the `install --plan/--apply` command, which is itself in the harness
package. Splitting into a third `@ps-neko/nekowork-catalog` package buys
nothing today and adds a publish artifact.

Revisit trigger: if `agents/` + `skills/` + `hooks/` LOC exceed 50 % of the
harness package's total LOC, *or* if a downstream consumer wants the
catalog without the harness CLI, split then.

### 4. CI matrix → **`pnpm -r test` single job, with per-package gate**

Both packages get their tests run by one job (`pnpm -r --filter "@ps-neko/*"
test`). The job fails if any workspace test fails. Two consequences:

- `.github/workflows/harness-validate.yml` gets the single `pnpm -r test`
  step. No matrix needed.
- Each package's `package.json` `test` script must work standalone
  (`@ps-neko/nekowork` cannot rely on `@ps-neko/nekowork-cli`'s test files).
  Phase B file moves must keep tests with the rule code.

Why: monorepo-native, less yaml drift, matches the existing
`harness-validate.yml` pattern (single workflow). Per-package CI jobs only
make sense once the packages have *different* test surfaces (long-running
integration, native-build matrix, etc.) — not the case here.

### What is *not* decided yet (Phase B)

These remain open and are NOT blockers for this skeleton merging:

- Exact deprecation notice copy for `@ps-neko/nekowork-cli` (Phase B writes it).
- Whether to keep `bin: harness` as well as `bin: nekowork` in the new slim
  package, or drop the legacy `harness` bin entirely. Currently the slim
  package exposes only `nekowork`; the old `nekowork-cli` keeps both for
  back-compat.
- Date of the deprecation cutover (depends on alpha tester confirmation).

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
