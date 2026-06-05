# Plan: Split installer concerns out of `@ps-neko/nekowork`

> Status: DRAFT · Date: 2026-05-27 · Owner: 1.0 prep · Linked: [SCOPE-1.0.md](../../packages/nekowork-cli/docs/SCOPE-1.0.md)

## 1. Problem

`@ps-neko/nekowork` currently ships **two unrelated things** in one npm package:

1. **Verification gate** — `verify-pr`, `check`, `report`, `apply` (the 1.0 hero)
2. **Harness installer** — agents/skills/hooks/manifests/packs that
   `nekowork install --apply` writes into a user's IDE config (Claude Code,
   Codex, Cursor, Gemini, OpenCode).

The README, SCOPE-1.0.md, npm description, and keywords have all been
narrowed to (1) — verification gate only. But the npm tarball still
publishes the catalog for (2): 11 agents, 11 skills, 5 hooks, 14 packs, 11
profiles, 5 harness build targets. Result: the tarball weighs and reads like
a "full development platform", contradicting the 1.0 message.

If we ship 1.0 as-is, the first review on Hacker News will be:
> "You say it's a verification gate but installing it dumps 200+ files of
> AI agents into my project."

## 2. Decision

Split into two packages under the same monorepo:

```text
@ps-neko/nekowork           (1.0 hero, slim)
  bin: nekowork
  surface: check | verify-pr | report | apply
  size target: < 500 KB unpacked

@ps-neko/nekowork-harness   (legacy + power-user)
  bin: nekowork-harness
  surface: install (--plan / --apply) | ask | plan | team | work | ...
  carries: agents/ skills/ hooks/ manifests/ packs/
```

Users who want only verification stay slim. Users who want the full harness
opt in with one extra `npm i`.

## 3. Migration mapping

### Source → destination

| Current path (`packages/nekowork-cli/`) | New owner |
|---|---|
| `scripts/cli.js` | `@ps-neko/nekowork` (dispatch only — 4 verbs) |
| `scripts/orchestrators/verify-pr.js` | `@ps-neko/nekowork` |
| `scripts/orchestrators/apply.js` | `@ps-neko/nekowork` (single-shot variant) |
| `scripts/orchestrators/report.js` | `@ps-neko/nekowork` (single-shot variant) |
| `scripts/lib/rules/**` | `@ps-neko/nekowork` |
| `scripts/lib/diff-parser.js` | `@ps-neko/nekowork` |
| `scripts/lib/decision.js` | `@ps-neko/nekowork` |
| `scripts/lib/severity.js` | `@ps-neko/nekowork` |
| `schemas/decision.schema.*` | `@ps-neko/nekowork` |
| `docs/QUICKSTART.md, SCOPE-1.0.md, INTEGRATION.md, BENCHMARK.md` | `@ps-neko/nekowork` |
| All other `docs/*.md` | `@ps-neko/nekowork-harness` |
| `agents/` | `@ps-neko/nekowork-harness` |
| `skills/` | `@ps-neko/nekowork-harness` |
| `hooks/` | `@ps-neko/nekowork-harness` |
| `commands/` | `@ps-neko/nekowork-harness` |
| `manifests/` | `@ps-neko/nekowork-harness` |
| `rules/` (catalog rules, not verify-pr rules — separate concept!) | `@ps-neko/nekowork-harness` |
| `scripts/cli/commands/auto-command.js, build-command.js, cockpit-command.js` | `@ps-neko/nekowork-harness` |
| `scripts/orchestrators/{ask,auto,build,gate,pr-prep,ralph,review,run,ship,team,team-lite,verify,work}.js` | `@ps-neko/nekowork-harness` |
| `scripts/install-plan.js, install-apply.js` | `@ps-neko/nekowork-harness` |
| `scripts/build-{claude,codex,cursor,gemini,opencode}.js` | `@ps-neko/nekowork-harness` |
| `scripts/agents/runners/codex.js` (legacy advisor) | `@ps-neko/nekowork-harness` |
| `scripts/agents/**` (other runners) | `@ps-neko/nekowork-harness` |
| `scripts/auth/**` | `@ps-neko/nekowork-harness` |
| `scripts/portability/**` | `@ps-neko/nekowork-harness` |
| `bridge/`, `examples/` | `@ps-neko/nekowork-harness` |
| `SOUL.md, RULES.md, CLAUDE.md, AGENTS.md, WORKING-CONTEXT.md, REVIEW.md` | repo-internal; not in either npm tarball |
| `tests/fixtures/**` | `@ps-neko/nekowork` (used by `bench:rules`) |
| `tests/unit/**` | split by file: rule + verify-pr tests stay; orchestrator tests move |

### Shared utilities

`scripts/core/**` (path helpers, env detection, fs wrappers) is needed by
both. Two options:

- (a) Duplicate the file into both packages (small surface, OK trade-off).
- (b) Extract into `@ps-neko/nekowork-shared` (cleaner, +1 package to manage).

Recommend (a) for v1 — re-evaluate at 1.1.

## 4. CLI surface after split

### `@ps-neko/nekowork` (4 verbs)

```bash
nekowork check               # 30-sec environment probe
nekowork verify-pr           # diff → verdict + REPORT.md + decision.json
nekowork report              # render an existing decision.json to REPORT.md
nekowork apply               # apply a stored .diff iff apply_allowed=true
```

Everything else exits 1 with: `unknown verb; did you mean to install @ps-neko/nekowork-harness?`

### `@ps-neko/nekowork-harness` (everything else)

Existing 16 orchestrators + install commands stay. The `nekowork-harness`
binary wraps them. README explicitly markets this package as
"power-user / legacy / Phase 1 deprecation timeline applies".

## 5. Workspace structure

```text
NEKOWORK/
├── package.json                # workspace root, private
├── pnpm-workspace.yaml         # adds the new package
├── packages/
│   ├── nekowork/               # NEW slim hero package
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── scripts/
│   │   ├── schemas/
│   │   ├── tests/
│   │   └── docs/
│   └── nekowork-harness/       # NEW legacy + harness package
│       ├── package.json
│       ├── README.md
│       ├── scripts/
│       ├── agents/
│       ├── skills/
│       ├── hooks/
│       ├── manifests/
│       ├── rules/              # catalog rules, distinct from verify-pr rules
│       ├── commands/
│       ├── bridge/
│       ├── examples/
│       └── docs/
└── packages/nekowork-cli/      # DEPRECATED — keep one version to emit
                                # deprecation notice; remove at 2.0
```

`@ps-neko/nekowork-cli` becomes a shim that prints:
```
@ps-neko/nekowork-cli is deprecated. Install @ps-neko/nekowork for the
verification gate, or @ps-neko/nekowork-harness for the full harness.
```

Stay-on-cli plan: ship one final alpha that re-exports both, then remove
the package in 2.0 per SCOPE-1.0.md §3 Phase 2 schedule.

## 6. Test plan

Each test must run against the new package layout.

1. `npm run test:unit` in each new package — green
2. `npm run bench:rules` in `@ps-neko/nekowork` — same numbers as today
3. Fresh `npx -y @ps-neko/nekowork@<new-alpha> verify-pr` smoke in a sample
   repo — verdict matches pre-split behavior
4. Fresh `npx -y @ps-neko/nekowork-harness@<new-alpha> install --plan
   --profile core` smoke — install plan identical to pre-split
5. CI matrix runs both packages in parallel (`pnpm -r test`)

Regression check: the 4 user-visible verb behaviors of the slim package
must produce **byte-identical REPORT.md and decision.json** for the same
input diff. Capture before/after on the same fixture and diff with `cmp`.

## 7. Rollout plan

**Phase A — same alpha as current cli, one new version (≈ 2 days)**
- `0.2.0-alpha.0`: monorepo restructure, both new packages publish, old
  `@ps-neko/nekowork-cli` retained as shim, no behavior changes
- Acceptance: identical REPORT.md / decision.json output on the 5
  case-study flows

**Phase B — README/SCOPE update, 1 day**
- Hero README now ships `@ps-neko/nekowork` (slim) only
- `@ps-neko/nekowork-harness` README is a power-user doc
- SCOPE-1.0.md §3 命令运命表 updated: removed/legacy commands now live in
  the harness package, not deprecated within the slim package

**Phase C — deprecation notice on old cli, 1 alpha cycle**
- `@ps-neko/nekowork-cli@0.2.0-alpha.1` prints the deprecation notice
- Wait for at least one alpha tester to confirm the migration path works

**Phase D — 2.0 release**
- Drop `@ps-neko/nekowork-cli` entirely
- 1.0 GA ships with two clean packages

## 8. Compatibility / migration table

| Today's command | Lives in | After split |
|---|---|---|
| `npx -y @ps-neko/nekowork verify-pr` | nekowork-cli | `@ps-neko/nekowork verify-pr` |
| `npx -y @ps-neko/nekowork check` | nekowork-cli | `@ps-neko/nekowork check` |
| `npx -y @ps-neko/nekowork install --apply --profile core` | nekowork-cli | `@ps-neko/nekowork-harness install --apply --profile core` |
| `nekowork team "..."` | nekowork-cli | `nekowork-harness team "..."` |
| `nekowork ship "..."` | nekowork-cli | `nekowork-harness ship "..."` |

Migration tool (optional, polish for Phase C):
`npx @ps-neko/nekowork-cli migrate` — detects the user's current install
profile and prints the exact two-line `npm install` + bin-rename to switch.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Existing `nekowork install --apply` users break on slim package | Phase C deprecation notice points to harness package |
| Test coverage gap during the move (unit tests reference paths) | Move tests with the code; run combined matrix in CI |
| Documentation drift between two READMEs | Generate a header from a shared source; lint for divergence |
| Cross-package shared util duplication | Accept duplication for v1; revisit at 1.1 |
| npm pkg name `nekowork-harness` may already exist | Check availability before Phase A; fallback `@ps-neko/harness` |

## 10. What this plan does NOT cover

- Actual CLI orchestrator code reduction (16 → 4 internal). That's a
  separate refactor; this plan just *re-homes* them.
- Live AI capture infrastructure (see `docs/LIVE-AI-CAPTURE.md`).
- OSS positive corpus growth (see `docs/BENCHMARK.md` §Gap to 1.0-ready).

## 11. Concrete next step (before committing to the plan)

1. Verify `@ps-neko/nekowork-harness` package name is available on npm.
2. Write a one-page user-facing migration note draft. Get one alpha user to
   read it cold. If they can articulate the split correctly, plan is good.
3. Then start Phase A in a dedicated branch.

This plan is a draft. Real cost is probably 3-5 days of careful refactor +
1 week of alpha bake. Acceptable trade-off if the goal is a clean 1.0
message — which it is.
