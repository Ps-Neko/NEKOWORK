# Demo walkthrough: NEKOWORK가 하드코딩 시크릿 fallback을 잡는 60초

> 60초 안에 외부 사용자에게 보여주기 위한 시나리오. 픽스처와 결과는 모두 실제 동작 산출물.

## 0. 사전 조건

- Node 22+, git, 최소 한 개 커밋이 있는 임의의 repo.
- 별도 install 불필요 — `npx -y` 한 줄로 실행.

## 1. AI가 무엇을 했나 (시뮬레이션)

Cursor / Claude Code / Codex가 인증 모듈을 수정하면서 환경 변수 fallback을 남겼다고 가정.

```diff
diff --git a/src/auth.ts b/src/auth.ts
index 0123abc..4567def 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -38,7 +38,7 @@ export function getAuthToken(): string {
-  const token = process.env.AUTH_TOKEN;
+  const token = process.env.AUTH_TOKEN || "dev-token-not-rotated";
   if (!token) throw new Error("AUTH_TOKEN missing");
   return token;
 }
```

표면적으론 "환경 변수가 없을 때 dev 토큰을 쓰는 fallback"으로 보이지만 — 실제로는 `dev-token-not-rotated` 문자열 자체가 코드에 박혀 git history에 남고 빌드 산출물에도 포함된다.

## 2. NEKOWORK가 무엇을 하나

```bash
npx -y @ps-neko/nekowork verify-pr
```

수행 흐름:

1. `git diff HEAD` 로 working-tree diff 추출.
2. 고정된 deterministic rule set 적용. 이 케이스에선 `secret-fallback` rule의 `env-or-literal` 패턴이 매치.
3. `REPORT.md` 와 `.nekowork/decision.json` 작성.
4. 종료 코드 비-0 (verdict = BLOCK).

콘솔 요약:

```text
=== verify-pr ===
  verdict        : BLOCK
  reason         : Hardcoded secret fallback at src/auth.ts:42 (env-or-literal)
  risk_level     : CRITICAL
  apply_allowed  : false
```

`REPORT.md` 발췌 (사람이 읽음):

```markdown
## BLOCK · src/auth.ts:42

`process.env.AUTH_TOKEN || "dev-token-not-rotated"` 는 환경 변수가 비어있을 때
하드코딩된 문자열을 사용한다. 이 문자열은 코드·git history·빌드 산출물에 영구
저장된다.

수정 제안:
- fallback을 제거하고 환경 변수 미존재 시 명시적으로 fail-fast.
- 또는 secret manager에서 런타임 로드.
```

## 3. 사람이 무엇을 하나

verdict는 **deterministic**. LLM이 다시 판정하지 않으므로 결과는 reproducible.
개발자는 `REPORT.md` 를 읽고 두 가지 중 하나를 선택한다.

1. fallback 제거 → 새 diff → `nekowork verify-pr` 재실행 → `ALLOW`.
2. 의도된 케이스라면 (e.g. 통제된 sandbox) `--include` 또는 explicit waiver로 별도 정책 적용.

`nekowork` 자체는 commit·push·merge·deploy를 절대 하지 않는다.

## 4. CI 그대로 끼우기 (5줄)

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: Ps-Neko/NEKOWORK@main
```

`BLOCK` 시 CI fail → PR merge 차단.

## 5. 시나리오를 재현하는 픽스처

위 walkthrough에 사용된 패턴은 다음 픽스처로 회귀 테스트됨:

- `packages/nekowork/tests/fixtures/secret-fallback/` — positive/negative 시드
- `packages/nekowork/tests/unit/secret-fallback.test.js` — `env-or-literal` 단위 테스트

CI에서 `npm test`로 통째 검증.
