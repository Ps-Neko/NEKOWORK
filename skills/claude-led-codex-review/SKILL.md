---
name: claude-led-codex-review
description: "Claude 주도 + Codex 위임 7단계 풀사이클 (idea → ship). Week 1 데모 정전(canon)."
origin: harness-core
level: 3
prerequisites: [tdd-workflow, plan-eng-review]
conflicts: []
auto_inject_keywords: []
tags: [workflow, review, codex, primary]
---

# claude-led-codex-review

Claude 가 구현하고 Codex 가 의심하는 7단계 풀사이클. **HARNESS 의 정전 워크플로우.** 자동 활성 키워드는 비워두고 명시 호출만 받는다 (사용자 환경의 "확인 후 실행" 류 룰을 우회하지 않기 위함).

## 호출

```bash
harness review "<task>"                    # 전체 사이클
harness review "<task>" --secure           # + 단계 6 codex-challenge 강제
harness review "<task>" --fast             # 단계 1·6 스킵
harness review "<task>" --no-ship          # 단계 7 생략 (리뷰까지만)
harness review "<task>" --no-codex         # 단계 5 스킵 (Codex CLI 미설치 시 mock)
```

또는 슬래시: `/claude-led-codex-review <task> [--flags]`

## 7단계

| # | 단계 | 담당 | 출력 |
|---|---|---|---|
| 1 | ideate | research, planner | `handoffs/01-ideate.md` |
| 2 | plan | planner (opus, ro) | `prd-<id>.md` + `handoffs/02-plan.md` |
| 3 | implement | executor (sonnet) + test-engineer | git diff, `handoffs/03-implement.md` |
| 4 | self-review | code-reviewer (opus, ro) | `handoffs/04-self-review.md` (JSON) |
| 5 | codex-review | codex-reviewer (별도 세션) | `handoffs/05-codex-review.md` (JSON) |
| 6 | codex-challenge | codex-challenger (--secure) | `handoffs/06-challenge.md` (JSON) |
| 7 | ship | doc-writer + git-master | PR + CHANGELOG diff + `handoffs/07-ship.md` |

## Stage Routing 표 (필수 / 옵션)

| Stage | Required | Optional (escalate) | 트리거 |
|---|---|---|---|
| 1 ideate | research, planner | architect | 모호한 요구 |
| 2 plan | planner | architect | 시스템 설계 |
| 3 implement | executor | debugger, test-engineer | TDD |
| 4 self-review | code-reviewer | security-reviewer | auth/crypto / >20파일 |
| 5 codex-review | codex-reviewer | — | --no-codex 가 아닐 때 |
| 6 codex-challenge | codex-challenger | — | --secure 또는 critical 발견 |
| 7 ship | doc-writer, git-master | — | 모든 게이트 PASS |

## Verdict 처리 + Fix Loop

각 단계의 핸드오프는 `verdict: block | approve_with_fixes | approve` 와 issues 배열을 갖는다.

```
[5 codex-review] ──verdict──┐
                            │
       block / w_fixes ─────▶ [3a fix-loop] ──▶ [4 self] ──▶ [5 codex]
                                    │
                              round++; 한도 = 3
                                    │
                              critical 1+ 또는 round ≥ 3 ──▶ HUMAN_GATE
                            │
       approve ─────────────▶ [6? challenge | 7 ship]
```

## --secure 자동 활성 조건

- 사용자 명시 플래그
- 변경에 다음 보안 카테고리 키워드 포함 (단어 경계 매칭, 대소문자 무시):
  - 인증·세션·시크릿: `auth`, `crypto`, `payment`, `session`, `permission`, `oauth`, `jwt`, `password`, `secret`
  - 자격증명·토큰: `token`, `apikey`, `api-key`, `api_key`
  - 인증서·전송보안: `cert`, `tls`, `ssl`, `mtls`
  - 웹 보안: `csrf`, `cors`, `xss`
  - 외부 검증: `webhook`
- 단계 5 verdict = block 후 round = 2 진입 시

## Fast 모드

`--fast`:
- 단계 1 (office-hours) 스킵 → 사용자 한 줄 → 바로 단계 2
- 단계 6 (challenge) 스킵 (--secure 가 같이 오면 무시)

단순 리팩토링·문서 변경에 권장. 보안·인증 코드에는 금지.

## 핸드오프 5필드

모든 단계의 마크다운 핸드오프는 `Decided / Rejected / Risks / Files / Remaining` 5필드를 지킨다. 자유 산문 금지. JSON 부속 (`schemas/handoff.schema.json`) 은 기계 처리용.

## 비용 / 토큰 정책

- Opus 에이전트(architect / planner / code-reviewer)는 read-only 강제 → 변경 비용 0.
- Codex / Gemini 워커는 사용자 ChatGPT Pro / Gemini Pro CLI 를 통해 호출 → Anthropic 토큰 소비 0.
- eco mode 시 opus → sonnet, sonnet → haiku (단계 4·5 는 sonnet floor).

## 단계별 상세

본 SKILL.md 가 단계별 상세의 정전(canon). 추가 노트 파일은 단계가 복잡해질 때 점진 추가.
