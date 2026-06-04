# Roadmap

Status date: 2026-05-14

This roadmap is intentionally small. NEKOWORK should improve the apply-before-change safety gate and evidence surface before expanding the agent catalog.

> **현재 시점 메모 (2026-06-04):** 현재 published 버전은 `0.1.0-alpha.12`입니다. 아래는 버전별 누적 로드맵 기록이며, 최신 변경은 [CHANGELOG](CHANGELOG.md)·[README](../README.md)를 참고하세요.

## 0.1.0-alpha.3

Status: released.

Goal: make the published package and first-run story easier to trust from the outside.

Released scope:

- Keep fresh `npx @ps-neko/nekowork@alpha check` smoke coverage in CI.
- Keep the generated terminal SVG for the one-minute demo path.
- Keep README focused on evidence, report output, Human Gate, and explicit apply.
- Keep the external feedback path for alpha users to paste `check --json` and `REPORT.md` summaries.
- Preserve the current catalog size unless a new agent, skill, hook, or pack directly strengthens verification evidence.

## 0.1.0-alpha.5

Status: released.

Goal: keep first-run install evidence internally consistent.

Released scope:

- Keep `agent.yaml` and `package.json` versions aligned.
- Cover release-surface version consistency with a unit test.
- Make `npx @alpha init --project-root .` the shortest documented target-project install path.
- Keep `@alpha check` smoke evidence green across local and GitHub Actions gates.

## 0.1.0-alpha.6

Status: released.

Goal: gather external feedback and keep the release path boring.

Released scope:

- Keep `@alpha` smoke evidence green across local and GitHub Actions gates.
- Establish the `builder` pack and `build` command as the safe all-in-one productivity entrypoint.
- Keep the `motdotla/dotenv` case study as the current new risk-class addition for environment configuration boundaries.
- Keep feedback triage docs and issue-template classification ready for real alpha reports.
- Avoid provider/API-key-first setup changes unless they preserve delegated local auth as the default.

Non-goals:

- No stable `latest` promotion.
- No automatic commit, push, publish, deploy, or apply.
- No bulk import of external agent packs.
- No API-key-first provider setup.

## Stable Release Track

Promote a stable release only after the alpha install path has repeated smoke evidence, external feedback, and no known moderate+ audit issues. Until then, docs should keep recommending `@alpha`.

## Build Intelligence Track

Status: in progress.

Goal: make `nekowork build "<task>"` smart enough that users do not need to know the safe mode flags first.

Current scope:

- Default `build` routing is `--mode auto`.
- Auto mode classifies task intent and risk.
- Auto mode selects `fast`, `safe`, `team`, `tdd`, or `release`.
- Auto mode selects read-only workers when useful.
- Auto mode records acceptance criteria, a mini plan, and post-build self-check prompts as session evidence.
- Build Intelligence explains routing decisions in dry-run, report, and `--explain` output.
- Risk-aware manual downgrades require `--force-mode` when a task has high/critical risk, Codex challenge, Human Gate, or security/financial/deploy/data tags.

## 0.1.0-alpha.8

Status: published public alpha.

Goal: make Build Intelligence policy easier to maintain without weakening the current guardrails.

Released scope:

- Move build mode safety rank metadata into a manifest/schema-backed contract.
- Add bounded `auto` mode for build/verify/repair/report autonomy before explicit apply.
- Keep `fast`, `team`, `tdd`, `release`, and `safe` ordering explicit in docs, validator checks, and tests.
- Add more routing fixtures for mixed-intent work, especially release plus security/data/financial signals.
- Keep forced override output consistent across dry-run and real build paths.
- Keep `@alpha` smoke, package dry-run, publish dry-run, lint, audit, and full tests green before alpha.8 publish.

Non-goals:

- No automatic apply, commit, push, publish, deploy, or PR creation.
- No parallel project-file writes.
- No provider call during `--dry-run`.
- No new mode that can bypass Codex verification, Human Gate, or explicit apply.

## 0.1.0-alpha.9

Status: published public alpha.

Goal: promote isolated parallel candidate evidence into the canonical ship-readiness path without allowing shared-worktree multi-agent writes.

Released scope:

- Keep the risk-blocking transcript and "Verified" definition near the README first screen.
- Keep starter packs first and the full pack catalog in advanced docs.
- Keep Quickstart centered on `auto -> report -> gate`.
- Keep 12 practical agentic harness pattern mapping in `docs/AGENTIC-PATTERNS.md`.
- Run `auto --parallel-candidates N` candidate evidence through candidate verification, arbiter selection, final Codex verification, canonical handoff promotion, and ship readiness.
- Add `examples/parallel-candidates-canonical` as a self-contained alpha.9 fixture.
- Keep apply, commit, push, publish, deploy, and PR creation explicit.

Non-goals:

- No new agent catalog expansion.
- No automatic apply, commit, push, publish, deploy, or PR creation.
- No rename of `.harness` or the `harness` compatibility alias during alpha.9.

## 0.1.0-alpha.10

Status: publish-ready alpha candidate.

Goal: make verified work easier to prepare for human code review.

Prepared scope:

- Add `nekowork pr-prep`.
- Generate PR summary, risk notes, test evidence, changelog draft, and ship/no-ship evidence.
- Add `REPORT.md` PR Prep section and a checked-in `examples/pr-prep-smoke` fixture.
- Keep PR creation, branch push, release, publish, and deploy as explicit human actions.
- Lock version consistency at lint time with `scripts/ci/check-version.js` and its unit fixture.
- Expose Provider Mode (`runtime.mode`, `runtime.providers`, `runtime.source`) on every decision artifact and surface it in `REPORT.md` and `nekowork build` verdict output.
- Publish the upstream artifact catalog as `docs/UPSTREAM-RECIPES.md` and link it from README "Works With" and `docs/INTEGRATION.md`.
- Re-sort the generated CLAUDE.md command surface into Beginner / Advanced / Legacy / Install, with `nekowork` as the canonical verb prefix.

Non-goals:

- No automatic apply, commit, push, publish, deploy, or PR creation.
- No removal of the `harness` compatibility alias.

## Beta Graduation Criteria

Status: target.

The 0.1.0-alpha line can graduate to a 0.2.0-beta line only when every criterion below holds at the same time. Each one is gated by checkable evidence, not opinion.

| # | Criterion | Evidence source |
|---|---|---|
| 1 | Version consistency is automated | `npm run lint` runs `check-version`; `VERSION`, `package.json`, `agent.yaml`, `WORKING-CONTEXT.md`, generated `CLAUDE.md`/`.claude/CLAUDE.md` stay aligned without manual fan-out |
| 2 | Provider Mode transparency | `decision.json.runtime` (mode, providers, source) is present on every handoff and rendered in `REPORT.md` Trust Card and `nekowork build` verdict for both mock and live runs |
| 3 | External alpha feedback absorbed | At least five external alpha users have submitted `check --json` plus `REPORT.md` evidence, and `docs/FEEDBACK-TRIAGE.md` records that no blocking issue is open |
| 4 | Smoke evidence streak | Seven consecutive days of green `@alpha` smoke across local and GitHub Actions, with the `@alpha` dist-tag matching the latest published version |
| 5 | Documentation completeness | README, QUICKSTART, AUTH-MIGRATION, UPSTREAM-RECIPES, and PRODUCT-PRINCIPLES each pass an external-reviewer pass without back-channel clarification (recorded in `docs/FEEDBACK-TRIAGE.md`) |
| 6 | Audit hygiene | `nekowork audit` reports zero moderate-or-higher findings within the last seven days |
| 7 | CLI naming canonical | All user-facing strings (CLI error output, docs code blocks, skill snippets) use `nekowork` as the canonical verb prefix; `harness` remains a permanent alias only |
| 8 | No automatic side effects | `apply`, `commit`, `push`, `publish`, `deploy`, and PR creation remain explicit human actions; no autonomy level (`cautious`, `normal`, `aggressive`) can bypass them |

Beta-line non-goals:

- No removal of the `harness` compatibility alias.
- No automatic apply, commit, push, publish, deploy, or PR creation.
- No bulk import of external agent packs.
- No API-key-first provider setup.
