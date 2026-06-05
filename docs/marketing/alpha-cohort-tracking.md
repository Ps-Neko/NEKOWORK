# Alpha Cohort Tracking

> Linked: [SCOPE-1.0.md §13.2](../../packages/nekowork-cli/docs/SCOPE-1.0.md#132-phase-1-timing-측정--이중-게이트) · [alpha-recruitment-drafts.md](./alpha-recruitment-drafts.md) · [.github/ISSUE_TEMPLATE/alpha-feedback.yml](../../.github/ISSUE_TEMPLATE/alpha-feedback.yml)
> Owner: maintainer · Update cadence: per new post / per new tester response

Ship gate (§13.2 Phase 1 → 1.0): **external alpha 3/5 "would use again" responses** + internal benchmark recall ≥ 0.90 + FP ≤ 0.10 + CRITICAL 미탐 0건 (already met).

This file is the single source of truth for the alpha cohort. Update it as you post and as responses come in.

---

## Posting log

| Date | Channel | Post URL | Initial signals (24h) | Response count (cumulative) |
|---|---|---|---|---:|
| **2026-05-27** | **r/cursor** | ~~https://www.reddit.com/r/cursor/comments/1toymc8/how_does_cursor_handle_envvar_defaults_in/~~ **(mod-removed)** | mod 삭제 — 신호 0 | 0 |
| **2026-05-27** | **r/ClaudeAI** | ~~https://www.reddit.com/r/ClaudeAI/comments/1toyt1m/caught_claude_code_opus_47_writing_the/~~ **(Reddit anti-spam filter)** | filter hidden — 신호 0 (mod queue 검토 대기) | 0 |
| _<YYYY-MM-DD>_ | GeekNews | _<thread URL>_ | _<upvotes / comments after 24h>_ | _<n>_ |
| _<YYYY-MM-DD>_ | DM 1 | _<who>_ | _<reply yes/no>_ | _<n>_ |
| _<YYYY-MM-DD>_ | DM 2 | _<who>_ | _<reply yes/no>_ | _<n>_ |

Hold posting Show HN until *after* 3/5 ship gate. Single shot, expensive.

### r/cursor 게시 + mod 삭제 (2026-05-27)

- 게시 제목: "How does Cursor handle env-var defaults in security-critical code? Claude Code (Opus 4.7) writes `process.env.X || 'fallback'` even when fully aware of the antipattern. Curious if you see the same."
- 본문: v3 ASCII-safe 변형 (em-dash → `--`, arrow → `->`, star → `stars`). UTF-8 클립보드 깨짐 해결.
- 플레어: Question / Discussion (Showcase 회피 — Rule 6 self-promo 한도)
- 결과: **mod 자동 또는 수동 삭제** ("이 게시물은 r/cursor의 운영진에 의해 삭제되었습니다.")

### r/cursor 삭제 사후분석

가능 원인 (확률 높은 순):
1. **Self-promo 비율** — Rule 6 "10% 이하". 계정 활동 이력이 적거나 promo 글 비율이 높으면 자동/수동 제거.
2. **계정 karma / 가입 시점** — 신규 계정 / 낮은 karma → 자동 mod 제거 트리거.
3. **GitHub 링크 다수** — 3개 링크(repo/benchmark/issue template) → spam 신호.
4. **본문 구조** — 질문 lead 였지만 후반의 도구 설명 + "Quickstart" + 결과 수치 + 알파 모집은 결국 promo 신호로 분류.

### r/ClaudeAI Reddit 글로벌 필터 사후분석 (2026-05-27)

링크 1개로 줄였는데도 **Reddit 전역 anti-spam 필터**가 즉시 삭제. r/cursor sub mod 와는 다른 메커니즘.

가능 원인 (확률 높은 순):
1. **계정 신뢰도 (account trust score)** — Reddit 신규/저-karma 계정 + 외부 링크는 거의 100% 자동 필터.
2. **연속 게시** — r/cursor 게시 직후 (~30분) 다른 sub 에 유사 글 → cross-sub spam 패턴.
3. **본문 + 링크 fingerprint** — "alpha", "testers", "feedback" + github.com 링크 = 클래식 spam 서명.

→ **Reddit 채널 전체가 현 계정으로는 막힘.** karma 빌드업 (관련 thread 댓글 며칠) 없이 즉시 게시 재시도는 같은 결과.

### 후속 전략 — 3 옵션

**A. 다른 sub 우회 (즉시 가능)**
- `r/ClaudeAI` — Claude self-test 가 finding 의 중심이라 정합성 강함. 일반적으로 AI 도구 토론에 관대.
- `r/programming` — karma 요건 있음 (보통 10+). 본 finding 의 일반화된 버전이면 통과 가능.
- `r/cscareerquestions` 또는 `r/devops` — security-relevant 관점.
- `r/ExperiencedDevs` — 약간 mature 한 톤. Rule 가 명확하지만 finding 형식엔 우호적.
- `r/SoftwareEngineering` — discussion-friendly.

**B. r/cursor mod 에게 정중하게 메시지 — 한 번 더 시도**
- 모드 메일로 게시 의도 설명 + Rule 6 자기 점검 결과 + 본문 톤 조정 의사 표시.
- 비용: 1-2일 대기. 답장 보장 없음.
- 회수: 만일 모드가 OK 하면 같은 sub 에서 더 신뢰성 있는 두번째 시도.

**C. GeekNews 부터 우회**
- 한국어 채널, self-promo 규칙 r/cursor 만큼 엄격하지 않음.
- 트래픽 작지만 한국 maintainer/DevOps 가 알파 tester 후보로 강함.

권장: **A → C 병행 → B 보류**.

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
| Posts published | 1 (r/cursor) |
| Tester responses | 0 |
| "Would use again" count | 0 / 5 |
| Internal benchmark | secret-fallback recall 98%, FP 0%, gate MET |
| Live-AI captures | 4 (all primed Claude Opus 4.7) |
| OSS positives | 46 across 4 rules |
| Phase B status | verify-pr + check internal in @ps-neko/nekowork (slim), report + apply pending |
| Blocker | r/cursor 24-48h 신호 측정 → r/ClaudeAI 게시 결정 → 5 tester cohort 모집 |
