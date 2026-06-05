# Alpha Recruitment — Posting Drafts

> Created: 2026-05-27 · Owner: SCOPE §13.1 (외부 알파 5명 모집)
> Goal: 5 alpha testers across 3 channels. Ship gate: 3/5 "would use again" responses (§13.2).

Three drafts below — one per channel. Pick the ones you want to post; tweak voice as needed.
All three lead with the same hook (the self-test finding: rule fired on Claude's own
output), then differ in tone and call-to-action by audience.

---

## Draft 1 — r/cursor (English)

**Title:** I built a local verification gate for AI-written code. It catches Cursor's most common security-relevant antipattern. Looking for 5 alpha testers.

```
The hook: I ran my own tool on Claude Code's output for a normal task
("add JWT auth middleware to this Express app"). Claude generated:

    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

Textbook `env-or-literal` antipattern. The rule fired CRITICAL on line 3.
Cursor produces the same family of patterns — anyone using AI coding tools
sees this kind of thing weekly.

What NEKOWORK is:
- Local CLI. Runs after your AI tool changes files.
- Deterministic risk rules (no LLM verdict). Same diff → same verdict, every run.
- Writes a REPORT.md + decision.json. You decide at the Human Gate.
- No auto-commit, no auto-push, no surprise deploy.

What it catches today (98% recall, 0 false positives on 84 fixtures —
12 synthetic, 46 real OSS from Cypress 49.6k⭐, Stagehand 22.8k⭐, eliza
18.5k⭐, Segment 12.4k⭐, etc., and 3 live AI captures):
- Secret fallbacks (process.env.X || "literal" and process.env.X || "")
- Hardcoded credential signatures (AWS keys, Stripe keys, etc.)
- Auto git push --force / commit / merge
- Bulk it.skip / @ts-nocheck / eslint-disable file-wide
- Postinstall scripts and curl|bash patterns

Quickstart (Node 22+):
    npx -y @ps-neko/nekowork@alpha verify-pr
    cat REPORT.md

Looking for 5 alpha testers who:
- Use Cursor (or Claude Code / Codex / Copilot) daily
- Run it on 1–2 real PRs over the next week
- Tell me one thing that's broken / annoying / wrong

Catch: it's alpha. Definitely has rough edges. The npm package is wider
than the 1.0 message (Phase B refactor in progress — `@ps-neko/nekowork`
slim package is coming).

Repo: https://github.com/Ps-Neko/NEKOWORK
Benchmark page (recall numbers + OSS sources): /packages/nekowork-cli/docs/BENCHMARK.md
Alpha feedback template: github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml

Honest disclaimer: "verified" means independently reviewed with recorded
evidence — not mathematically proven correct. The verdict is rule-based,
never LLM.

Comment, DM, or open an issue if you're in.
```

---

## Draft 2 — r/ClaudeAI (English)

**Title:** I caught Claude Code (Opus 4.7) writing a security antipattern on its first try. Open-sourcing the detection tool and looking for 5 alpha testers.

```
I'm building a local verification gate for AI-written code. To dogfood it,
I gave Claude Code a normal task: "Add JWT-based auth middleware to this
Express app." Claude generated this on line 3:

    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

The kicker: the Claude session already had full context of my anti-pattern
rules and the spec doc that lists this exact pattern as the killer case. It
still produced the antipattern naturally because the training distribution
is full of it. Then I ran the rule on Claude's output — CRITICAL hit.

Tool: NEKOWORK. It's a local CLI that:
- Reads your working-tree diff (or PR range)
- Runs deterministic risk rules (no LLM verdict — same diff always same
  result)
- Writes REPORT.md + decision.json with the verdict (BLOCK /
  NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE / ALLOW_WITH_WARNINGS / ALLOW)
- Never auto-commits, auto-pushes, or deploys. Human Gate on apply.

Current numbers (84 fixtures: 12 synthetic + 46 OSS + 3 live AI):
- 99% recall, 0 false positives
- OSS sources include Cypress (49k⭐), Stagehand (22k⭐), eliza (18k⭐),
  MongoDB (10k⭐), Segment Evergreen (12k⭐)

Quickstart:
    npx -y @ps-neko/nekowork@alpha verify-pr
    cat REPORT.md
    cat .nekowork/decision.json

Looking for 5 alpha testers — use it on one PR over the next week, tell me
one thing that's broken. No marketing back-channel, no funnel — your feedback
becomes a GitHub issue I respond to directly.

Repo: https://github.com/Ps-Neko/NEKOWORK
Self-test write-up (the "Claude caught itself" finding):
  /packages/nekowork-cli/docs/BENCHMARK.md#first-live-ai-capture
Live-AI capture protocol (if you want to run the same self-test on
other tools): /packages/nekowork-cli/docs/LIVE-AI-CAPTURE.md
Feedback template:
  github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml

Caveats: alpha, rough edges. The "verified" label means independently
reviewed with recorded evidence — not mathematically proven correct.
Codex review is optional, recorded as advisor only, and never controls
the verdict.

Comment if you're in. Bonus points if you can reproduce the JWT_SECRET
antipattern on a fresh (non-primed) Claude session — that's a stronger
data point than my self-capture.
```

---

## Draft 3 — GeekNews (한국어)

**제목:** 클로드 코드가 본인이 작성한 보안 안티패턴을 본인이 만든 도구로 잡혔다 — NEKOWORK 알파 테스터 5명 모집

```
배경
AI 코딩 도구(클로드 코드 / 커서 / Codex / Copilot)가 작성하는 코드를
머지/적용 전에 검증하는 로컬 CLI 도구 NEKOWORK 를 만들고 있습니다.

자체 테스트한 결과가 흥미로워서 공유합니다.

테스트
클로드 코드(Opus 4.7) 세션에게 평범한 작업을 시켰습니다:
"이 Express 앱에 JWT 인증 미들웨어 추가"

같은 세션이 이미 NEKOWORK 의 룰 정의를 읽은 상태였는데도, 자연스럽게
이 라인을 생성했습니다 (middleware/auth.js:3):

    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

NEKOWORK 의 secret-fallback 룰이 같은 코드를 CRITICAL 로 적중.
교과서적인 env-or-literal 안티패턴. AI 가 다음 환경변수에 동일 패턴을
주기적으로 만들어내는 걸 실측으로 확인:

    process.env.JWT_SECRET     || ""
    process.env.OPENAI_API_KEY || ""
    process.env.STRIPE_SECRET_KEY || "..."
    process.env.AWS_ACCESS_KEY_ID || "..."

NEKOWORK 가 하는 일
- 워킹트리 diff 또는 PR 범위 스캔
- 결정적 룰 (LLM 판정 없음) — 같은 diff 면 항상 같은 verdict
- REPORT.md + .nekowork/decision.json 출력
- Human Gate: apply 는 명시적, 자동 commit/push/deploy 절대 없음

현재 측정 (84 fixture: synthetic 12 + 실제 OSS 46 + live-AI 3)
- recall 99%, false positive 0건
- OSS 출처: Cypress (49k⭐), Stagehand (22k⭐), eliza (18k⭐),
  세그먼트 Evergreen (12k⭐), MongoDB (10k⭐), 외 30개

빠른 실행
    npx -y @ps-neko/nekowork@alpha verify-pr
    cat REPORT.md

알파 테스터 5명 모집 — 다음 조건:
- 클로드 코드 / 커서 / Codex 등 AI 코딩 도구를 일상적으로 사용
- 향후 1주일 사이 실제 PR 1~2개에 NEKOWORK 적용
- 한 가지 (망가진/이상한/짜증나는 점) 알려주기

피드백 채널: GitHub Issue (템플릿 제공)
  github.com/Ps-Neko/NEKOWORK/issues/new?template=alpha-feedback.yml

레포: https://github.com/Ps-Neko/NEKOWORK
벤치마크 페이지 (recall 수치 + OSS 출처 명시):
  /packages/nekowork-cli/docs/BENCHMARK.md
자체 검증 결과 (클로드 코드가 본인 안티패턴에 적중된 사례):
  /packages/nekowork-cli/docs/BENCHMARK.md#first-live-ai-capture

정직한 주의사항
- 알파입니다. 거친 부분 있음.
- "verified" 의 정의: 독립 리뷰 + 증거 기록. 수학적 증명 아님.
- Codex review 는 advisor only — verdict 결정에 영향 0.

댓글 / DM / Issue 환영합니다.
```

---

## Posting checklist

For each channel:

- [ ] **r/cursor** — read sub rules (low self-promo subreddit) and post as a "I built X, looking for testers" not "promo". Sticky-thread or Show-and-tell weekly if available.
- [ ] **r/ClaudeAI** — same. Highlight the "Claude caught itself" self-test as the lead.
- [ ] **GeekNews (news.hada.io)** — link to the repo + benchmark page. Korean voice matches the README.ko.md tone.

Optional after the three:
- [ ] DM 2 specific people who use AI tools daily (warm channel, fastest signal)
- [ ] Show HN — hold until alpha.13 or alpha.14 after the 5-tester signal is real (high-cost single shot)

## Tracking

Create a tracking issue or section in `WORKING-CONTEXT.md`:

```
Alpha tester pipeline:
- r/cursor post: <date posted>, <thread URL>, responses: <count>
- r/ClaudeAI post: ...
- GeekNews post: ...
- DM 1: <person>, replied: yes/no
- DM 2: <person>, replied: yes/no

Tester signals received (3/5 needed for SCOPE §13.2):
1. <tester>: would_use_again = yes/no/maybe, feedback_link = ...
2. ...
```

Ship gate hits 3/5 → 1.0 release candidate.
