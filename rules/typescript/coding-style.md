# typescript/coding-style — TS/JS 룰

> 이 문서는 [common/coding-style.md](../common/coding-style.md) 를 TypeScript / JavaScript 관용에 맞춰 확장한다.

## 1. 타입

### 공개 API

- export 되는 함수·클래스 메서드는 인자·반환 타입을 명시한다.
- 로컬 변수의 명백한 타입은 추론에 맡긴다.
- 반복되는 inline object 형태는 `interface` / `type` 으로 추출.

```ts
// 잘못됨
export function formatUser(user) { return `${user.firstName} ${user.lastName}`; }

// 올바름
interface User { firstName: string; lastName: string; }
export function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}
```

### `interface` vs `type`

- 객체 형태 + 확장 가능성: `interface`.
- 유니온 / 교차 / 튜플 / 매핑 타입: `type`.
- `enum` 보다 string literal union (`type Role = 'admin' | 'member'`) 선호.

### `any` 금지

- 어플리케이션 코드에서 `any` 사용 금지.
- 외부·신뢰 못 하는 입력은 `unknown` 으로 받고 narrow.
- 캐스팅(`as`) 은 시스템 경계 한 곳에서만, 그 즉시 검증.

```ts
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unexpected error';
}
```

### React props

- `interface XxxProps { ... }` 로 정의. 콜백 prop 시그니처 명시.
- `React.FC` 사용 안 함 (불필요한 제네릭 + children 암묵 주입).

### `.js` 파일

- TS 마이그가 어려운 곳은 JSDoc 으로 타입 표현. 런타임 동작과 동기화.

## 2. 비동기

- `async / await` + `try / catch` 기본.
- Promise chain (`.then().catch()`) 보다 `await`.
- 병렬 실행은 `Promise.all`. 단일 실패가 다른 호출을 막아도 OK 면 `Promise.allSettled`.
- top-level await 은 ES module 안에서만 사용.

## 3. 불변성

- spread / `Readonly<T>` / `as const` 활용.
- mutation 이 필요하면 그 함수 안에서만, 반환 값은 새 객체.

```ts
function rename(user: Readonly<User>, name: string): User {
  return { ...user, name };
}
```

## 4. 에러

- `Error` 를 직접 던지지 말고 도메인 에러 클래스 (`class NotFoundError extends Error`) 사용.
- catch 의 `err: unknown` 을 narrow 후 처리.
- `console.error` 직접 사용 안 함 — 로거(pino / winston) 경유.

## 5. 입력 검증

- 외부 경계는 zod / ajv 로 schema 검증.
- 검증된 타입은 `z.infer<typeof schema>` 로 추론해서 단일 진실.

## 6. import

- 상대 경로 `../../..` 가 3단 이상이면 alias (`@/`) 도입 검토.
- side-effect import 는 파일 최상단 한 곳에 모은다.
- 미사용 import 는 `eslint-plugin-unused-imports` 로 제거.

## 7. console.log

- 운영 코드에 `console.log` 금지. PostToolUse hook 이 경고.
- 디버깅 출력은 `debug` 패키지 또는 로거의 `debug` 레벨.

## 8. 도구

- 포매터: Prettier. PostToolUse hook 으로 자동.
- 린터: ESLint (`@typescript-eslint`).
- 타입 체크: `tsc --noEmit` PR 게이트.
- 테스트: vitest (이 프로젝트의 devDependency).
