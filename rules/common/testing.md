# common/testing — 테스트 공통 규칙

> 본 룰은 `verification.required_coverage_pct: 80` 와 `quality-gate` 훅이 강제한다.

## 1. 테스트 종류

3가지 모두 필수:

1. **Unit Tests** — `tests/unit/<area>.test.<ext>`. 함수·유틸·컴포넌트 단위.
2. **Integration Tests** — `tests/integration/<scenario>.test.<ext>`. API 엔드포인트, DB 트랜잭션, 파일 IO.
3. **E2E Tests** — `tests/e2e/<flow>.test.<ext>`. 핵심 사용자 흐름.

## 2. 커버리지 하한

- 라인 커버리지 80% 이상 유지.
- 새 PR 의 라인 커버리지가 베이스 브랜치 대비 떨어지면 `quality-gate` 차단.
- 핵심 도메인(보안 / 결제 / 데이터 일관성)은 90% 이상 권장.

## 3. TDD 워크플로우

`skills/tdd-workflow/SKILL.md` 와 정합:

1. **RED** — 실패하는 테스트 먼저 작성.
2. **GREEN** — 통과시킬 최소 구현.
3. **REFACTOR** — 중복 제거, 네이밍 정리.
4. **VERIFY** — 커버리지·린트 확인.

## 4. 테스트 격리

- 각 테스트는 독립적으로 실행 가능해야 한다 (실행 순서 의존 금지).
- 글로벌 상태 변경은 `setup` / `teardown` 으로 복구.
- 외부 시스템(DB, 네트워크)은 통합 테스트에서만 사용. 단위 테스트는 mock.

## 5. 결정성

- `Date.now()`, `Math.random()`, UUID 같은 비결정 소스는 주입(injection)으로 대체.
- 테스트가 가끔 실패하면 즉시 격리(`.skip`)하고 원인 추적 — 무시하지 않는다.

## 6. 데이터

- 픽스처는 `tests/fixtures/<area>/` 에 둔다.
- 가능한 한 작고 의미가 명확한 데이터.
- 실 운영 데이터를 그대로 가져오지 않는다 (PII 위험).

## 7. 실패 분석 순서

`tdd-workflow` 와 동일:

1. 격리: 다른 테스트와 독립적으로 실패하는가?
2. 결정성: 같은 입력에 같은 결과인가?
3. 모킹: mock 이 실 구현과 합치하는가?
4. 구현 vs 테스트: 어느 쪽이 잘못됐는가? — 보통 구현. 테스트가 잘못이면 명시적으로 그 근거를 PR 설명에.

## 8. CI 게이트

- `npm run test` (또는 언어별 등가) 가 PR 단계에서 통과해야 한다.
- `npm run validate:all` 도 함께 통과해야 한다.
- `harness review --no-ship` 으로 로컬 풀체인 미리 돌려볼 수 있다.
