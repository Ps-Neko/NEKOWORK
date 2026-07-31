# Decision Card Design

## Objective

Make the visualizer's verification result immediately actionable for an operator or team lead.  The first card on the page must state whether work may proceed, why, and what to do next before the user needs to read the detailed evidence.

## Assumptions

- This applies only to the existing static visualizer under `packages/nekowork-cli/docs/visualizer`.
- It presents the selected fixture; it does not change CLI verdict logic, file formats, or apply behavior.
- Existing Korean-first copy and the current design tokens remain the visual baseline.

## User Flow

1. The user opens a fixture page.
2. The user sees a decision card directly below the hero.
3. The card communicates the verdict, risk level, one-sentence reason, and a next action.
4. The action link moves focus to the already-existing evidence section for detail.

## Success Criteria

- A decision card appears before the existing demo summary.
- It renders the fixture verdict, risk level, rule ID, file and line when available.
- It offers an action appropriate to the verdict: inspect evidence for `BLOCK`, request review for `NEEDS_HUMAN_REVIEW`, or proceed to the human gate otherwise.
- The action is a keyboard-accessible anchor with an accessible label.
- The layout works at 320px and preserves the existing visualizer test suite.

## Scope Boundaries

- Always: preserve deterministic verdict semantics and reuse existing fixture data.
- Ask first: add dependencies, change CLI output/schema, alter deployment configuration.
- Never: imply that NEKOWORK auto-approves, auto-merges, auto-pushes, or auto-applies changes.

## Commands

- Type check: `pnpm --filter @ps-neko/visualizer typecheck`
- Build: `pnpm --filter @ps-neko/visualizer build`
- Browser tests: `pnpm --filter @ps-neko/visualizer test`

## Implementation Plan

### Task 1: Add a tested decision-card renderer

- Acceptance: a semantic, data-driven card renders a verdict summary and its next-action link for each verdict family.
- Verify: add a Playwright assertion that fails before the renderer exists, then passes after implementation.
- Files: `src/renderer.ts`, `tests/a11y.test.ts`.

### Task 2: Style the card responsively

- Acceptance: verdict meaning is expressed in text as well as color, and the card remains readable at 320px.
- Verify: browser tests and visual inspection at desktop and mobile viewports.
- Files: `src/styles.css`, `tests/a11y.test.ts`.

### Checkpoint

- `typecheck`, `build`, and the visualizer browser tests pass.
- The page has no console errors and the new link sends users to the evidence section.

## Risks

| Risk | Mitigation |
| --- | --- |
| The card accidentally looks like automated approval | Keep the final decision language explicit: human review remains required. |
| Future verdict values render poorly | Use a conservative default copy and existing badge styles. |
| Mobile layout becomes crowded | Use the existing one-column breakpoint and test it at 320px. |
