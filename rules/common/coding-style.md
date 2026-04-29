# common/coding-style — 언어 무관 공통 규칙

> 이 문서는 모든 언어 룰의 베이스. 언어별 디렉터리(`typescript/`, `python/`)가 이 룰을 확장한다.
> 본 룰의 위반은 `quality-gate` → `code-reviewer` → `codex-reviewer` 단계에서 차단된다.

## 1. 불변성 우선

원본 객체는 변경하지 않는다. 새 객체를 만들어 돌려준다.

```
// 잘못됨 (mutation)
modify(original, "field", value)   // original 자체가 바뀜

// 올바름 (immutable)
new = update(original, "field", value)   // original 보존, 새 객체 반환
```

근거: side effect 격리, 디버깅 단순화, 동시성 안전.

> **언어 노트**: Go·Rust 처럼 mutation 이 관용적인 언어는 해당 언어 룰이 이 원칙을 재정의할 수 있다.

## 2. 파일 조직

작은 파일 다수 > 큰 파일 소수.

- 보통 200~400 줄, 800줄을 넘으면 분할 후보.
- 응집도(cohesion) 높게, 결합도(coupling) 낮게.
- 도메인 / 기능 단위로 묶고, 타입(`utils.ts`, `helpers.ts` 같은 잡동사니) 으로 묶지 않는다.

## 3. 함수

- 1 함수 1 책임. 50줄 넘으면 분할 후보.
- 부정 조건은 early-return 으로 거두고 nesting 4단계 초과 금지.
- 인자 4개 초과 시 객체로 묶거나 빌더 패턴 검토.

## 4. 네이밍

- 가독성 > 짧음. `r`, `tmp`, `data2` 금지.
- 부울 변수·함수는 `is`, `has`, `can`, `should` 접두사.
- 상수는 SCREAMING_SNAKE_CASE.
- 약어는 단어 취급(파스칼/카멜 케이스에서 `Url`, `Api` — 모두 대문자 금지).

## 5. 에러 처리

- 모든 레벨에서 명시적으로 처리한다.
- UI 표면에는 사용자 친화적 메시지, 서버 로그에는 풀 컨텍스트.
- 절대 silent swallow 금지(빈 catch / `except: pass`).
- 시스템 경계(외부 API, 사용자 입력, 파일 입력)에서만 검증·차단.

## 6. 입력 검증

- 시스템 경계에서 schema 검증 (TS: zod / ajv, Python: pydantic).
- 외부에서 들어온 데이터는 신뢰하지 않는다.
- fail-fast: 잘못된 입력은 즉시 명확한 메시지로 거부.

## 7. 부수 효과 명시

- 네트워크 / 디스크 / 글로벌 상태 변경은 함수 시그니처와 이름에 드러난다.
- 순수 함수는 순수하게 두고, side-effect 가 있는 호출은 한 곳으로 모은다(orchestrator 패턴).

## 8. 코드 리뷰 체크리스트

작업을 끝났다고 표시하기 전 확인:

- [ ] 모든 새 함수 50줄 이하, nesting 4단계 이하.
- [ ] 외부 입력 검증 있음.
- [ ] 에러는 처리되거나 명시적으로 throw.
- [ ] 하드코딩된 값 없음 (상수 / 환경 변수 / 설정 사용).
- [ ] mutation 없음 (또는 mutation 이 의도적이고 주석 있음).
- [ ] 공개 API 의 타입 / 시그니처 명시.
- [ ] 단위 테스트 추가, 80% 커버리지 유지 (`common/testing.md`).
