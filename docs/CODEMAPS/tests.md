# CODEMAP — tests

> 자동 생성. `scripts/build-codemaps.js` 가 `tests/` 를 스캔. 직접 편집 금지.
> 코드 본문은 포함 안 함. 네비게이션 보조용.

## 디렉터리 트리

```
tests/
├── e2e/
│   └── review-cycle.test.js
├── integration/
│   └── build-pipeline.test.js
├── optional/
│   └── keychain-smoke.test.js
└── unit/
    ├── auth-guard.test.js
    ├── core-utils.test.js
    ├── costs.test.js
    ├── git-mutation-guard.test.js
    ├── instincts.test.js
    ├── orchestrator.test.js
    ├── portability.test.js
    ├── router.test.js
    ├── runners-extract.test.js
    ├── severity.test.js
    └── token-vault.test.js
```

## 핵심 export

| 파일 | export | 설명 |
|---|---|---|
| `e2e/review-cycle.test.js` | _(none)_ | E2E: claude-led-codex-review 풀사이클(7단계) 시뮬레이션을 격리 워크스페이스에서 검증. scripts/demo-review.js 의 핸드오프 흐름을 재실행하고 산출 파일 / round 카운터  |
| `integration/build-pipeline.test.js` | _(none)_ | 통합: install plan → apply → 5개 빌더 산출 → state 영속 → repair 정합 까지의 풀체인. 별도 워크스페이스로 카피해서 실행. 본 레포의 .harness/install-state.jso |
| `optional/keychain-smoke.test.js` | _(none)_ | 실 OS keychain 종단 검증. 기본 npm test 에서 실행되지 않음 (tests/optional/ 은 패턴에 미포함). 수동 실행: HARNESS_KEYCHAIN_SMOKE=1 npm run test:ke |
| `unit/auth-guard.test.js` | _(none)_ |  |
| `unit/core-utils.test.js` | _(none)_ |  |
| `unit/costs.test.js` | _(none)_ |  |
| `unit/git-mutation-guard.test.js` | _(none)_ |  |
| `unit/instincts.test.js` | _(none)_ |  |
| `unit/orchestrator.test.js` | _(none)_ | review 오케스트레이터 단위 테스트. mock provider 로 결정론적. node:test based orchestrator checks. |
| `unit/portability.test.js` | _(none)_ |  |
| `unit/router.test.js` | _(none)_ |  |
| `unit/runners-extract.test.js` | _(none)_ | live runner 의 JSON 추출 / prompt 빌더 단위 테스트. Claude/Codex CLI 미설치 환경에서도 동작 (실 호출 없음). |
| `unit/severity.test.js` | _(none)_ |  |
| `unit/token-vault.test.js` | _(none)_ |  |

