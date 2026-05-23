# Verification Report — sample-pr-001

> NEKOWORK 12-station verdict for `feat(auth): JWT 검증 미들웨어 추가`.

## Summary

- **Project**: sample-pr-001
- **Task**: demo-jwt-middleware
- **Verdict**: **BLOCK** (riskLevel: critical)
- **Apply**: NOT ALLOWED — human approval required
- **Generated**: 2026-05-23T05:30:00Z

## Triggered deterministic rules (1)

### `hardcoded-credential-fallback` — CRITICAL

- File: `src/auth.js`
- Line: 3
- Pattern: `process.env.X || "<literal>"`
- Snippet:

  ```js
  const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-key";
  ```

NEKOWORK rule pack `hardcoded-credential-fallback` 은 환경변수 fallback 으로 literal secret 을 박는 패턴을 critical 로 차단한다. dev fallback 이 production 빌드에 누출되면 JWT 서명 키가 source 에 박힘 → 토큰 위조 가능.

## Advisor input (claude-review.json)

Claude advisor 는 `LGTM` 를 출력했다 (manufactured demo). advisor 의 시야는 implementation flow 정합성에 한정되어 있어 hardcoded fallback 의 deployment risk 는 deterministic rule 의 책임으로 남는다. 본 보고서는 advisor 출력을 **opinion** 으로 표기하고 **verdict** 와 동등하게 다루지 않는다.

## Apply decision

`apply.allowed = false`. 사용자가 human gate 에서 위 violation 을 수동 reject 또는 fix 후 재검증 필요.

## Evidence trail

- `evidence/preverify-summary.json` — preverify v0 의 6-axis check 결과
- `evidence/verify-summary.json` — verify v0 의 acceptance coverage
- `evidence/decision.json` — verify stage 의 sub-decision (deterministic rule fail 시점)
- `claude-review.json` — advisor (Claude) 의 LGTM 출력 (manufactured for demo)
