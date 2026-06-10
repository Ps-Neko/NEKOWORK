---
name: verified-gate
description: "NEKOWORK verify-pr 게이트를 hard-fail 모드로 실행해 deterministic risk verdict 와 evidence 를 확인하고, verdict 카드로 ship/no-ship 을 제시한다."
origin: harness-core
level: 1
prerequisites: []
conflicts: []
auto_inject_keywords: []
tags: [gate, verification, strict, ci]
---

# verified-gate

현재 워킹트리 변경을 **NEKOWORK 1.0 검증 게이트**에 통과시킨다. 세 가지를 강제한다:

- LLM verdict 를 신뢰하지 않고 deterministic risk rules 와 선택적 `--run-checks` 결과만 본다.
- `--ci-exit-soft` 없이 실행해 `NEEDS_HUMAN_REVIEW` / `INSUFFICIENT_EVIDENCE` / `BLOCK` 을 **non-zero exit** 으로 유지한다.
- `REPORT.md` 와 `.nekowork/decision.json` 을 같은 판정에서 나온 evidence 로 확인한다.

## 사용 시점

- PR/커밋 직전 ship/no-ship 을 한 번에 판정하고 싶을 때.
- CI 에서 "검증 안 함"이 "통과"로 새지 않도록 강제하고 싶을 때.
- 명시 옵트인 전용 — 자동 키워드 활성은 하지 않는다(프로젝트 정책).

## 동작

1. 프로젝트 NEKOWORK CLI 로 verify-pr 게이트를 실행한다. source checkout 에서는 `node packages/nekowork-cli/scripts/cli.js verify-pr`, 설치된 slim 패키지에서는 `nekowork verify-pr` 를 사용한다:
   ```bash
   nekowork verify-pr --from-working-tree
   ```
   동작 검증까지 evidence 에 포함해야 하는 heavy harness/source checkout 에서는 명시 승인 후:
   ```bash
   node packages/nekowork-cli/scripts/cli.js verify-pr --from-working-tree --run-checks
   ```
2. **exit code 를 신뢰해** 판정하고(verdict 텍스트만 보고 통과시키지 않는다), `.nekowork/decision.json` 과 `REPORT.md` 를 읽어 **verdict 카드**로 제시한다:

   | exit | verdict | 카드 | 의미 |
   |---|---|---|---|
   | 0 | ALLOW / ALLOW_WITH_WARNINGS | ✅ | merge 판단 가능 |
   | 1 | NEEDS_HUMAN_REVIEW / INSUFFICIENT_EVIDENCE | ⚠️ | 사람 검토 또는 추가 증거 필요 |
   | 2 | BLOCK | 🚫 | critical risk 로 차단 |

3. no-ship(⚠️/🚫)이면 `REPORT.md` 의 triggered rules·reasons 를 요약하고 다음 행동을 안내한다.
4. ship-ready(✅)여도 자동 apply/merge 는 하지 않는다. 사람의 merge 결정 또는 별도 session 기반 `apply --session <id>` 흐름으로 넘긴다.

## 원칙

- **apply/merge 를 자동 실행하지 않는다.** 게이트는 판정만, 최종 변경 반영은 사용자의 명시적 결정으로만.
- 차단은 exit code 로 강제된다(권고가 아니다). 단, `--ci-exit-soft` 는 이 스킬에서 쓰지 않는다.
- 이 스킬은 슬래시 명령이 아니라 스킬+CLI 로 호출한다 (프로젝트의 "슬래시 신규 금지" 정책 준수).
