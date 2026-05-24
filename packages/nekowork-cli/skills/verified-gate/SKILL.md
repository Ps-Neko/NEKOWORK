---
name: verified-gate
description: "독립 검증 게이트를 strict 모드로 실행해 review 미실행/경고/위험을 non-zero exit 으로 차단하고, verdict 카드로 ship/no-ship 을 제시한다."
origin: harness-core
level: 1
prerequisites: []
conflicts: []
auto_inject_keywords: []
tags: [gate, verification, strict, ci]
---

# verified-gate

현재 워킹트리 변경을 **strict 검증 게이트**에 통과시킨다. 일반 `gate` 와 달리 세 가지를 강제한다:

- review 미실행(`not_run`)·실패(`failed`)를 PASS 로 묻지 않고 `PASS_WITH_WARNINGS` 로 가시화한다 (미검증 = 미통과).
- `--strict` 는 그 경고·위험을 **non-zero exit 으로 차단**한다 — CI 에서 게이트 자체가 빨갛게 빠진다.
- `decision.json` 은 content-hash 로 `audit.jsonl` 에 결박되어, gate 이후 사후 변조 시 `apply` 가 거부한다.

## 사용 시점

- PR/커밋 직전 ship/no-ship 을 한 번에 판정하고 싶을 때.
- CI 에서 "검증 안 함"이 "통과"로 새지 않도록 강제하고 싶을 때.
- 명시 옵트인 전용 — 자동 키워드 활성은 하지 않는다(프로젝트 정책).

## 동작

1. 프로젝트 harness CLI 로 strict 게이트를 실행한다 (`nekoforge` 우선, 없으면 `harness` / `nekowork` 폴백):
   ```bash
   nekoforge gate --strict --task "<task-id, 기본 TASK-001>"
   ```
2. **exit code 를 신뢰해** 판정하고(verdict 텍스트만 보고 통과시키지 않는다), `.harness/decision.json` 과 `REPORT.md` 를 읽어 **verdict 카드**로 제시한다:

   | exit | verdict | 카드 | 의미 |
   |---|---|---|---|
   | 0 | PASS | ✅ | clean. apply 가능 |
   | 3 | NEEDS_HUMAN_REVIEW / PASS_WITH_WARNINGS | ⚠️ | 사람 검토 필요 (경고·미검증 포함) |
   | 4 | BLOCK / INSUFFICIENT_EVIDENCE | 🚫 | 차단 (critical / 증거 부족) |

3. no-ship(⚠️/🚫)이면 `REPORT.md` 의 triggered rules·reasons 를 요약하고 다음 행동을 안내한다.
4. ship-ready(✅)면 `nekoforge apply --approved` 를 **안내만** 한다.

## 원칙

- **apply 를 자동 실행하지 않는다.** 게이트는 판정만, apply 는 사용자의 명시적 승인으로만.
- 차단은 exit code 로 강제된다(권고가 아니다).
- 이 스킬은 슬래시 명령이 아니라 스킬+CLI 로 호출한다 (프로젝트의 "슬래시 신규 금지" 정책 준수).
