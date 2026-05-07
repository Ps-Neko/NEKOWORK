# Plan

## Implementation

1. Create a static `index.html` entry point.
2. Build a responsive dashboard layout in `src/styles.css`.
3. Render a canvas portfolio chart and watchlist in `src/app.js`.
4. Keep order inputs and side buttons disabled.
5. Add local fixture data under `fixtures/market.json`.
6. Add `scripts/check.mjs` to verify the mock-only boundary.

## Acceptance Criteria

| ID | Criteria |
|---|---|
| AC-001 | Dashboard opens as a static browser page. |
| AC-002 | Portfolio chart and watchlist render from mock data. |
| AC-003 | Buy/sell/order controls are disabled. |
| AC-004 | Test fails if broker, payment, or outbound API wiring appears. |

## Human Gate

Human approval is required before any ship-ready claim because this is a financial UI surface.
