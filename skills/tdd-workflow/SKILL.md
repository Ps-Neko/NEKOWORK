---
name: tdd-workflow
description: "RED → GREEN → REFACTOR. 한 사이클 = 한 acceptance criteria = 한 작은 커밋."
origin: harness-core
level: 2
prerequisites: []
conflicts: []
tags: [implementation, testing]
---

# TDD Workflow

executor 가 따르는 워크플로우. 한 번에 하나의 AC.

## 사이클

1. **RED** — 테스트 작성. 실행. 실패 확인. (`expected: ... received: undefined`)
2. **GREEN** — 최소 변경으로 통과. 다른 테스트 깨지면 안 됨.
3. **REFACTOR** — 가독성 / 중복 제거. 모든 테스트 다시 통과.
4. **COMMIT** — `feat(<area>): <ac-id> <한 줄>`. 커밋 메시지 한국어 OK.

## quality-gate 통과 강제

PostToolUse 훅이 매 Edit / Write 후 다음을 실행:

- TypeScript: `tsc --noEmit`
- Python: `ruff check . && mypy`
- 포맷: prettier / black 자동
- 테스트: 변경 파일의 unit 테스트만 (`node --test tests/unit/*.test.js` 또는 `pytest --picked`)

실패 시 다음 도구 호출 차단.

## 80% 커버리지 게이트

`npm run test:coverage` 가 line / function / branch / statement 4개 모두 80% 미달 시 ship 차단.

## 금지

- 한 커밋에 2개 이상 AC.
- 테스트 없는 변경.
- 약화된 단언 (`expect(true).toBe(true)`).
- `--no-verify` 사용.
