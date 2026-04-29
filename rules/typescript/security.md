# typescript/security — TS/JS 보안 룰

> [common/security.md](../common/security.md) 의 TS/JS 확장.

## 1. 시크릿

```ts
// 잘못됨
const apiKey = "sk-proj-xxxxx";

// 올바름
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY 미설정');
```

- 시작 시 검증. 부재 시 기동 실패.
- `dotenv` 사용 시 `.env` 는 `.gitignore`.

## 2. 입력 검증

- HTTP body / query / params 는 zod 로 schema 검증:

```ts
import { z } from 'zod';
const Body = z.object({ email: z.string().email(), age: z.number().int().min(0) });
const parsed = Body.parse(req.body);   // 실패 시 ZodError 던짐
```

- `parse` (throw) vs `safeParse` (`{success, data | error}`) 용도에 맞게.

## 3. SQL / DB

- `pg` / `postgres` / Prisma — 모두 parameterized.
- raw SQL 작성 시 `${value}` 보간 절대 금지. `$1`, `$2` 자리표시자 사용.
- ORM 의 `raw` API 는 검토 후만.

## 4. XSS

- React 의 `dangerouslySetInnerHTML` 사용 시 sanitize (`dompurify`) 필수.
- 사용자 입력 → URL 로 사용 시 `encodeURIComponent`.

## 5. CSRF

- SameSite cookie + CSRF token 둘 다.
- API only 면 토큰 인증 (Bearer) + CORS allowlist.

## 6. JWT

- 검증 시 `algorithms: ['RS256']` 명시. `none` 차단.
- `iat` / `exp` 둘 다 확인.
- secret 은 환경 변수.

## 7. 의존성

- `npm audit --omit=dev` 정기 실행.
- 새 의존성 추가 전 `npmjs.com` 의 weekly downloads, last publish 확인.
- typosquatting 주의 (`color` vs `colors`, `lodash` vs `lodash-utils`).

## 8. SSR / 서버 액션

- Next.js server action 의 입력은 클라이언트가 임의 조작 가능 — 반드시 재검증.
- 인가는 매 액션마다 확인.

## 9. 에이전트 지원

- 보안 변경: `security-reviewer` 에이전트로 사전 검토.
- 인증 / 결제 / PII 다루는 PR 은 `harness review --secure` 로 codex-challenge 단계 강제.
