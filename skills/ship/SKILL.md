---
name: ship
description: "단계 7. 모든 게이트 PASS 후 PR 생성 + CHANGELOG + 핸드오프 첨부."
origin: harness-core
level: 2
prerequisites: [review]
conflicts: []
tags: [release, pr]
---

# ship

claude-led-codex-review 단계 7. 자동 push 는 하지 않는다 (사용자 / CI 환경에서 명시 트리거).

## 사전 조건 (모두 PASS 필요)

- [ ] quality-gate 통과 (포맷·린트·타입체크)
- [ ] 단위 / 통합 / e2e 테스트 통과
- [ ] 80% 커버리지
- [ ] self-review verdict = approve
- [ ] codex-review verdict = approve
- [ ] (--secure 시) codex-challenge verdict = approve
- [ ] 모든 핸드오프 파일 존재 (`handoffs/01..07`)

위 중 하나라도 실패 → 차단.

## 동작

1. doc-writer 가 PR 본문 초안 작성 (한국어).
2. doc-writer 가 `docs/CHANGELOG.md` 갱신 (`feat / fix / ...` 접두사).
3. doc-writer 가 `WORKING-CONTEXT.md` 의 "Latest Execution Notes" 갱신.
4. git-master (Day 6 이후) 가 브랜치 생성 + 핸드오프 7개 첨부 + PR 초안 등록.
5. **자동 머지 / push 금지** — 사용자 또는 CI 가 명시 트리거.
6. `handoffs/07-ship.md` 작성.

## 출력

```
✓ harness review --no-ship 모드 종료
  PR 초안: <branch> → main
  핸드오프: handoffs/01..07 (7개)
  CHANGELOG diff: docs/CHANGELOG.md
  다음: 사용자 검토 후 'gh pr create' 또는 'git push' 수동 실행
```
