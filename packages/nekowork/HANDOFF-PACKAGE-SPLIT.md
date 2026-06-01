# `@ps-neko/nekowork` package split — status

> Branch: `feat/package-split` originated 2026-05-27. After the NEKOWORK pivot (2026-06-01) the split goal narrowed: the slim package **is the product**, not a delegation shim to a heavier harness package.

## Current state — slim package is independent

- `scripts/cli.js` — 2-verb dispatch (`check`, `verify-pr`). No `execFileSync` to a sibling package.
- `scripts/lib/{decision,diff-parser,project-detector,risk-classifier,severity}.js` and `scripts/lib/rules/*` — all present, byte-identical to the corresponding legacy harness sources.
- `scripts/orchestrators/verify-pr.js`, `scripts/check.js` — native.
- `tests/unit/*.test.js` (7 files) and `tests/fixtures/*` (7 categories) cover all rules + decision engine + risk classifier.
- `package.json` `dependencies: {}` — `verify-pr` and `check` use only Node built-ins.

Smoke verifications (run locally):

- `node scripts/cli.js --version` → prints the package version.
- `node scripts/cli.js` (no args) → prints help with the 2 verbs.
- `node scripts/cli.js team` → exits non-zero and lists supported verbs (`scripts/smoke-reject.js`).
- `node scripts/cli.js verify-pr ...` → runs the orchestrator natively.

## Decisions overridden after the pivot

The original split plan had several decisions that no longer apply:

1. **`report` / `apply` verb migration → cancelled.** The slim CLI exposes 2 verbs (`check`, `verify-pr`). Session-based verbs belong to the harness narrative, which is on hold.
2. **`@ps-neko/nekowork-harness` rename + 1-cycle deprecation of `@ps-neko/nekowork-cli` → deferred.** The harness package is not the product. Renaming is a publish-time concern, not a code-correctness concern.
3. **Catalog ownership (`agents/`, `skills/`, `hooks/`, `manifests/`, `packs/`) → unchanged.** Catalog is not in the slim verification gate's scope.

## Open items (post-pivot, manual)

- Publish dry-run for `@ps-neko/nekowork@0.2.0-alpha.1`. Validate the tarball contents against the `files:` whitelist in `package.json`.
- Decide the fate of the legacy `@ps-neko/nekowork-cli` npm name (deprecate, freeze, or leave). No code change required here; this is an npm-registry action.
- Renaming `packages/nekowork-cli/` directory → out of scope until the harness narrative is revived.
