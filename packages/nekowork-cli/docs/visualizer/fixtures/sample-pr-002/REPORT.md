# Verification Report — sample-pr-002

> NEKOWORK 12-station verdict — 승인 후 코드 변조(audit-integrity) 차단 데모.

## Summary

- **Verdict**: **BLOCK** (riskLevel: critical)
- **Apply**: NOT ALLOWED — 승인이 다른 decision 해시에 결박됨
- **Approved decision hash**: `sha256:7c4a8d09…`  ·  **Current**: `sha256:9f2b1c7d…`

## Triggered finding — `audit-integrity` (CRITICAL)

사람이 승인한 코드(H1)와 머지 대상 코드(H2)가 다르다. NEKOWORK 는 승인 시점의
`decision.json` canonical 해시를 audit chain 의 `gate_verdict` 이벤트에 anchor 한다
(`forge-engine/src/utils/integrity.ts`). apply 는 decision 을 재해싱해 anchor 와
대조하고, 어긋나면 거부한다 (`gate/index.ts` 의 `audit anchor mismatch`).
→ 승인 후 변경된 코드는 **승인되지 않은 것**으로 본다. "A 를 승인하고 B 를 머지" 가
구조적으로 불가능.

## Advisor input (manufactured)

Claude advisor 는 현재 흐름에 `LGTM` 를 냈다. advisor 는 "이 승인이 어느 decision
해시에 묶였는가" 를 보지 않으므로, 변조 탐지는 gate 의 `audit-integrity` 책임으로
남는다. 본 advisor 출력은 opinion 이며 verdict 와 동등하게 다루지 않는다.

## 왜 이게 moat 인가

단일 패턴 게이트(secret-fallback 등)는 경쟁 하네스가 스킬 하나로 흉내 낼 수 있다.
그러나 "승인을 decision 해시에 anchor 해 사후 변조를 무효화" 하려면 canonical
해싱·재계산·audit chain 결박·우회봉쇄 기계를 실제로 만들어야 한다(#65–68). 이
fixture 가 그 차이를 시각화한다.

## Evidence trail

- `evidence/preverify-summary.json` — preverify v0 의 6-axis check 결과
- `evidence/verify-summary.json` — verify v0 의 acceptance coverage + gates
- `evidence/decision.json` — verify-deterministic stage 의 sub-decision
- `claude-review.json` — advisor (Claude) 의 LGTM 출력 (manufactured for demo)
