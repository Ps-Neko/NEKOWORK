# Roadmap

Status date: 2026-05-08

This roadmap is intentionally small. NEKOWORK should improve the evidence surface before expanding the agent catalog.

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
