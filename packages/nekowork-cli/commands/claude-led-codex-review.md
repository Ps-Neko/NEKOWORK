---
description: "Claude 주도 + Codex 위임 7단계 풀사이클. claude-led-codex-review 스킬 호출."
---

# /claude-led-codex-review

이 슬래시 명령은 `claude-led-codex-review` 스킬의 legacy compat 진입점이다. 신규 워크플로우는 스킬에서 정의되지만 슬래시 호출 호환성을 위해 보존.

## 동작

`Skill` 도구로 `claude-led-codex-review` 를 즉시 호출. 인자가 있으면 작업 요약으로 전달, 없으면 사용자에게 한 줄 요약을 요청.

## 인자

- `$ARGUMENTS` — 작업 요약 한 줄
- `--fast` — 단계 1·6 스킵
- `--secure` — 단계 6 강제
- `--no-ship` — 단계 7 생략

## 예시

```
/claude-led-codex-review JWT 검증 미들웨어 추가 --secure
/claude-led-codex-review 결제 환불 로직 버그 수정
/claude-led-codex-review --fast 사소한 리팩토링
/claude-led-codex-review 새 API 엔드포인트 --no-ship
```

전체 명세는 `skills/claude-led-codex-review/SKILL.md` 참조.
