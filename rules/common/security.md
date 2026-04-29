# common/security — 보안 공통 규칙

> 본 룰은 `gateguard-fact-force`, `config-protection`, `audit log` 훅과
> `security-reviewer` 에이전트가 강제한다. 위반 시 자동 차단.

## 1. 시크릿

- 코드에 하드코딩 금지 (API key, password, token).
- 환경 변수 또는 시크릿 매니저 사용.
- 시작 시 필수 변수 존재 확인 — 없으면 명시적 에러로 종료.
- 노출된 시크릿은 즉시 rotate.

## 2. 입력 검증

- 모든 외부 입력(HTTP 요청, 파일, 환경 변수, 외부 API 응답)은 schema 로 검증.
- SQL injection: parameterized query 만 사용. string concat 금지.
- XSS: HTML 출력은 escape. raw html 삽입은 명시적 sanitize 후만.
- 경로 traversal: `..` 와 절대 경로 차단.

## 3. 인증·인가

- 인증 없는 엔드포인트는 명시적으로 표시 (`@public`).
- 인가는 리소스 단위로 매번 확인 (역할 기반만으로 부족).
- 세션 토큰은 `httpOnly` + `secure` + `sameSite=strict`.

## 4. Rate Limiting

- 모든 외부 노출 엔드포인트에 rate limit 적용.
- 인증 실패 / 회원가입 / 비밀번호 재설정은 더 엄격하게.

## 5. 에러 메시지

- 사용자 표면: 일반적인 메시지 ("요청을 처리하지 못했습니다").
- 서버 로그: 풀 컨텍스트 (스택, 입력값 — 단 시크릿은 redact).
- 에러 메시지로 시스템 내부 구조(파일 경로, 스택, DB 컬럼명) 노출 금지.

## 6. 의존성

- 모든 npm / pip / cargo 의존성은 SemVer 핀.
- `@latest` 금지.
- 정기적으로 `npm audit` / `pip-audit` / `cargo audit` 실행.
- `lockfile` 은 커밋한다.

## 7. MCP / 외부 서비스

- `agent.yaml` 의 `mcp.external_servers` 는 SemVer 핀 필수 (`mcp_pin_required: true`).
- 새 MCP 서버 추가 시 `security-reviewer` 검토 후 머지.

## 8. 커밋 전 체크리스트

- [ ] 하드코딩된 시크릿 / API 키 없음.
- [ ] 모든 입력 검증.
- [ ] SQL parameterized.
- [ ] XSS / CSRF 방어 활성.
- [ ] 인증·인가 검증.
- [ ] Rate limit 설정.
- [ ] 에러 메시지에 민감 정보 없음.
- [ ] 의존성 SemVer 핀.

## 9. 사고 대응

문제 발견 시:

1. **STOP** — 즉시 작업 중단.
2. `security-reviewer` 에이전트로 영향 범위 분석.
3. CRITICAL 은 다른 작업보다 우선.
4. 노출된 시크릿 rotate.
5. 같은 패턴이 다른 코드에 있는지 grep.
6. 사후: `docs/dev-log/` 에 incident note 추가.
