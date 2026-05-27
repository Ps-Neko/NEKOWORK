# Alpha Cohort Tracking

> Linked: [SCOPE-1.0.md §13.2](../../packages/nekowork-cli/docs/SCOPE-1.0.md#132-phase-1-timing-측정--이중-게이트) · [alpha-recruitment-drafts.md](./alpha-recruitment-drafts.md) · [.github/ISSUE_TEMPLATE/alpha-feedback.yml](../../.github/ISSUE_TEMPLATE/alpha-feedback.yml)
> Owner: maintainer · Update cadence: per new post / per new tester response

Ship gate (§13.2 Phase 1 → 1.0): **external alpha 3/5 "would use again" responses** + internal benchmark recall ≥ 0.90 + FP ≤ 0.10 + CRITICAL 미탐 0건 (already met).

This file is the single source of truth for the alpha cohort. Update it as you post and as responses come in.

---

## Posting log

| Date | Channel | Post URL | Initial signals (24h) | Response count (cumulative) |
|---|---|---|---|---:|
| _<YYYY-MM-DD>_ | r/cursor | _<thread URL>_ | _<upvotes / comments after 24h>_ | _<n>_ |
| _<YYYY-MM-DD>_ | r/ClaudeAI | _<thread URL>_ | _<upvotes / comments after 24h>_ | _<n>_ |
| _<YYYY-MM-DD>_ | GeekNews | _<thread URL>_ | _<upvotes / comments after 24h>_ | _<n>_ |
| _<YYYY-MM-DD>_ | DM 1 | _<who>_ | _<reply yes/no>_ | _<n>_ |
| _<YYYY-MM-DD>_ | DM 2 | _<who>_ | _<reply yes/no>_ | _<n>_ |

Hold posting Show HN until *after* 3/5 ship gate. Single shot, expensive.

---

## Tester cohort

Track each tester from first contact → final signal. Anonymize public copies if a tester asks.

### Tester 1 — _<handle or alias>_
- **Channel**: r/cursor / r/ClaudeAI / GeekNews / DM
- **First contact**: _<YYYY-MM-DD>_
- **Tool**: Claude Code / Cursor / Codex / Copilot
- **Background**: _<one-line — what kind of project they tried it on>_
- **First run output**: _<link to their `decision.json` or REPORT.md if they shared, OR redacted summary>_
- **Issues filed**: _<list of issue numbers via alpha-feedback template>_
- **"would use again" signal**: _<yes / no / unclear / no response>_
- **Notes**: _<anything that helps the next conversation>_

### Tester 2 — ...
(same fields)

### Tester 3 — ...
### Tester 4 — ...
### Tester 5 — ...

---

## Signal aggregation — ship gate check

Run this calculation each time a tester finalizes their answer.

| Tester | "would use again" |
|---|:---:|
| Tester 1 | _<yes/no>_ |
| Tester 2 | _<yes/no>_ |
| Tester 3 | _<yes/no>_ |
| Tester 4 | _<yes/no>_ |
| Tester 5 | _<yes/no>_ |
| **Yes count** | **_<n>_ / 5** |

- **n >= 3** → §13.2 external signal **MET** → 1.0 release candidate prep can start
- **n < 3 with > 50% remaining time budget** → continue cohort
- **n < 3 with budget exhausted** → re-evaluate hypothesis (wedge, distribution, or product)

---

## Lessons / themes

As responses come in, log recurring themes here. They become the README's "common feedback" section if there's a pattern, or 1.x roadmap items if they're feature requests.

| Date | Tester | Theme | Action |
|---|---|---|---|
| _<YYYY-MM-DD>_ | _<n>_ | _<short label>_ | _<filed as issue #X / addressed in PR #Y / dropped because reason>_ |

---

## Anti-patterns (do NOT do)

- ❌ Mark a response as "yes" if the tester said "interesting / nice / I'll check it out" — not a "would use again" signal.
- ❌ Post all 3 channels on the same day; stagger 2-3 days so signal-per-channel is attributable.
- ❌ Reply to negative feedback with reasons-it-is-actually-fine. Take it, file the issue, ship the fix.
- ❌ Promote NEKOWORK as "verified-correct" or "AI-OS" in any reply — keep the verification-gate framing.
- ❌ Edit `alpha-recruitment-drafts.md` after posting unless one of the channels gives substantive doc feedback to roll back into the message.

---

## State at session creation (2026-05-27)

| Field | Value |
|---|---|
| Posts published | 0 |
| Tester responses | 0 |
| "Would use again" count | 0 / 5 |
| Internal benchmark | secret-fallback recall 98%, FP 0%, gate MET |
| Live-AI captures | 4 (all primed Claude Opus 4.7) |
| OSS positives | 46 across 4 rules |
| Phase B status | verify-pr + check internal in @ps-neko/nekowork (slim), report + apply pending |
| Blocker | external alpha posting (this file's "Posting log" section) |
