# typescript/testing — TS/JS 테스트 룰

> [common/testing.md](../common/testing.md) 의 TS/JS 확장.

## 1. 프레임워크

- 단위 / 통합: **vitest** (이미 devDependency).
- E2E: **Playwright**.
- 노드 코어 스크립트(`scripts/`): `node --test` 로 충분.

## 2. 파일 위치

- 단위: `tests/unit/<area>.test.js` (이 레포는 ESM `.js`).
- 통합: `tests/integration/<scenario>.test.js`.
- E2E: `tests/e2e/<flow>.spec.ts`.
- 픽스처: `tests/fixtures/<area>/`.

## 3. vitest 패턴

```ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('router', () => {
  beforeEach(() => { /* reset */ });
  it('opus 로 critical 라우팅', () => {
    expect(route({ severity: 'critical' })).toBe('opus');
  });
});
```

- `it.each` 로 테이블 케이스.
- `vi.mock` 으로 모듈 모킹 — 실 구현 import 가 모킹된 모듈을 받도록 hoisting 주의.

## 4. node:test 패턴 (스크립트)

이 레포의 `tests/unit/*.test.js` 는 다음 형태:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route } from '../../scripts/lib/router.js';

test('router: critical → opus', () => {
  assert.equal(route({ severity: 'critical' }), 'opus');
});
```

실행: `node --test tests/unit/*.test.js`.

## 5. 모킹

- 외부 의존(SDK, 네트워크) 만 mock. 자체 모듈은 가능한 한 실 구현.
- `vi.fn()` 은 호출 인자·횟수까지 검증.
- `nock` / `msw` 로 HTTP 모킹.

## 6. 비동기 테스트

- `async () => { ... }` 로 작성, await 누락 방지.
- 타임아웃 명시 (`{ timeout: 10000 }`) — 기본 5000ms 보다 길어야 하면 이유 주석.

## 7. E2E (Playwright)

- 파일: `tests/e2e/<flow>.spec.ts`.
- Trace + 스크린샷 + 비디오 자동 첨부 (`use: { trace: 'retain-on-failure' }`).
- CI 에서 워커 1, 로컬에서 multiple OK.
- 데이터: 격리된 테스트 사용자 또는 세션.

## 8. 커버리지

- vitest: `npx vitest run --coverage`.
- v8 또는 istanbul 백엔드. 라인 80% 이상.
- `coverage/` 는 `.gitignore`. `lcov.info` 만 CI 아티팩트로.

## 9. 에이전트 지원

- 새 기능 / 버그 수정: `tdd-guide` 에이전트 (skills/tdd-workflow).
- E2E 흐름: `e2e-runner` 에이전트.
- 실패 분석: `debugger` 에이전트.
