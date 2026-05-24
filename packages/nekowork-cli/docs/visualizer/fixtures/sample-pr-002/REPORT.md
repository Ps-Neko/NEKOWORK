# Verification Report — sample-pr-002

> NEKOWORK 12-station verdict — 승인 후 변조(approval-hash-mismatch) 차단 데모.

## Summary

- **Verdict**: **BLOCK** (riskLevel: critical)
- **Apply**: NOT ALLOWED — 승인이 다른 코드 해시에 결박됨
- **Approved hash**: `sha256:7c4a8d09…`  ·  **Current hash**: `sha256:9f2b1c7d…`

## Triggered rule — `approval-hash-mismatch` (CRITICAL)

사람이 승인한 코드(H1)와 머지 대상 코드(H2)가 다르다. NEKOWORK 는 인간 승인을
코드 해시에 결박하므로, 승인 후 변경된 코드는 **승인되지 않은 것**으로 본다.
→ "A 를 승인하고 B 를 머지" 가 구조적으로 불가능.

## Advisor input (manufactured)

Claude advisor 는 현재 흐름에 `LGTM` 를 냈다. advisor 는 "이 승인이 어느 해시에
묶였는가" 를 보지 않으므로, 변조 탐지는 deterministic rule 의 책임으로 남는다.
본 advisor 출력은 opinion 이며 verdict 와 동등하게 다루지 않는다.

## 왜 이게 moat 인가

단일 패턴 게이트(secret-fallback 등)는 경쟁 하네스가 스킬 하나로 흉내 낼 수 있다.
그러나 "승인을 코드 해시에 결박해 사후 변조를 무효화" 하려면 결박·재계산·우회봉쇄
기계를 실제로 만들어야 한다(#65–68). 이 fixture 가 그 차이를 시각화한다.

## Evidence trail

- `evidence/preverify-summary.json` — preverify v0 의 6-axis check 결과
- `evidence/verify-summary.json` — verify v0 의 acceptance coverage + gates
- `evidence/decision.json` — verify-deterministic stage 의 sub-decision
- `claude-review.json` — advisor (Claude) 의 LGTM 출력 (manufactured for demo)
