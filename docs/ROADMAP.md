# Roadmap

Status date: 2026-05-13

This roadmap is intentionally small. NEKOWORK should improve verified autopilot behavior and the evidence surface before expanding the agent catalog.

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

Status: publish-ready alpha candidate.

Goal: promote isolated parallel candidate evidence into the canonical ship-readiness path without allowing shared-worktree multi-agent writes.

Prepared scope:

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

Status: planned.

Goal: make verified work easier to prepare for human code review.

Planned scope:

- Add `nekowork pr-prep`.
- Generate PR summary, risk notes, test evidence, changelog draft, and ship/no-ship evidence.
- Keep PR creation, branch push, release, publish, and deploy as explicit human actions.

Non-goals:

- No automatic apply, commit, push, publish, deploy, or PR creation.
