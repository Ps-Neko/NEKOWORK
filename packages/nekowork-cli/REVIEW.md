# REVIEW.md

> Codex 독립 검증 단계의 핸드오프 표준. Claude / Codex / 사람이 같은 포맷으로 의사소통한다.

## 핸드오프 5필드 (고정)

```markdown
# Handoff: <NN>-<stage>

**Decided**: 무엇을 결정했는가 (1~3줄)
**Rejected**: 무엇을 의도적으로 거절했는가 + 이유 (1~3줄)
**Risks**: 알려진 리스크 (1~3줄)
**Files**: 변경된 또는 영향받는 파일 (목록)
**Remaining**: 다음 단계 / 미해결 (1~3줄)
```

총 10~20줄. 자유 산문 금지.

## 단계별 핸드오프

| 파일 | 작성자 | 내용 |
|---|---|---|
| `01-ideate.md` | research / planner | 문제 재정의 + 후보 접근 |
| `02-plan.md` | planner | PRD 요약 + acceptance criteria 카운트 |
| `03-implement.md` | executor | 구현 요약 + TDD 사이클 카운트 |
| `04-self-review.md` | code-reviewer | issues JSON 요약 (severity별 카운트) |
| `05-codex-review.md` | codex-reviewer | issues JSON + verdict |
| `06-challenge.md` | codex-challenger | adversarial 발견 |
| `07-ship.md` | doc-writer / git-master | PR URL + CHANGELOG diff |

## Codex 출력 JSON 스키마

```json
{
  "issues": [
    {
      "severity": "critical | high | medium | low | info",
      "category": "security | correctness | performance | style | test | docs",
      "file": "string",
      "line": "integer",
      "summary": "string (한 줄)",
      "why": "string (1~3줄)",
      "suggested_fix": "string | null"
    }
  ],
  "verdict": "block | approve_with_fixes | approve",
  "confidence": "number (0.0 ~ 1.0)",
  "round": "integer"
}
```

전체 스키마는 `schemas/handoff.schema.json` 참조.

## Verdict 처리

| verdict | 처리 |
|---|---|
| `block` | executor 재호출 (round++), critical/high 모두 입력으로 |
| `approve_with_fixes` | 자동 fix 후 재리뷰 (round++) |
| `approve` | 다음 단계 진행 (--secure 면 단계 6, 아니면 단계 7) |

round ≥ 3 → human gate.

## Severity 분류 규칙

- **critical**: 보안 취약점 (auth bypass, 시크릿 노출, SQL injection, RCE), 데이터 손실, 프로덕션 다운
- **high**: 회귀, 기능 미동작, DB 스키마 위반, 성능 회귀 ≥ 30%
- **medium**: 가독성 / 유지보수성 부채, 미사용 코드, 잘못된 에러 처리
- **low**: 스타일, 네이밍, 미세한 비효율
- **info**: 제안, 학습 노트

## Categories 분류

- **security** — 인증, 권한, 시크릿, 입력 검증, 외부 API
- **correctness** — 로직 오류, 엣지 케이스, race condition
- **performance** — N+1, 메모리, 알고리즘
- **style** — 포맷, 네이밍, 컨벤션
- **test** — 누락, 약한 단언, 잘못된 모킹
- **docs** — README, 주석, CHANGELOG

## Round 카운터

세션 내 단계별 누적. `.harness/state/sessions/<id>/round.json`:

```json
{ "review": 1, "challenge": 0 }
```

## Human Gate Trigger

- severity = critical 발견 (1건이라도)
- round ≥ 3
- blast radius (변경 파일 수) ≥ 20
- 사용자가 명시적으로 `--human-always` 지정

게이트 발동 시 `.harness/state/sessions/<id>/HUMAN_GATE` 파일 생성, 오케스트레이터가 멈추고 사용자에게 핸드오프.
