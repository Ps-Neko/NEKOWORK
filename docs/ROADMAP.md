# Roadmap

Status date: 2026-05-07

This roadmap is intentionally small. NEKOWORK should improve the evidence surface before expanding the agent catalog.

## 0.1.0-alpha.2

Goal: make the published package and first-run story easier to trust from the outside.

Planned scope:

- Keep fresh `npx @ps-neko/nekowork@alpha doctor --quick` smoke coverage in CI.
- Keep the generated terminal SVG for the one-minute demo path.
- Keep README focused on evidence, report output, Human Gate, and explicit apply.
- Keep the external feedback path for alpha users to paste `doctor --quick --json` and `REPORT.md` summaries.
- Preserve the current catalog size unless a new agent, skill, hook, or pack directly strengthens verification evidence.

Non-goals:

- No stable `latest` promotion.
- No automatic commit, push, publish, deploy, or apply.
- No bulk import of external agent packs.
- No API-key-first provider setup.

## Stable Release Track

Promote a stable release only after the alpha install path has repeated smoke evidence, external feedback, and no known moderate+ audit issues. Until then, docs should keep recommending `@alpha`.
