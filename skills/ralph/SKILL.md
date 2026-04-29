---
name: ralph
description: "PRD AC 가 모두 passes:true 될 때까지 반복 실행. 명시 옵트인만 (사용자 룰: 자동 활성 금지)."
origin: harness-core
level: 3
prerequisites: [tdd-workflow, claude-led-codex-review]
conflicts: [auto-merge]
auto_inject_keywords: []
tags: [persistent, loop]
---

# ralph

PRD 의 acceptance criteria 가 모두 PASS 될 때까지 review 사이클을 자동 반복. 사용자 글로벌 룰("자동 활성 금지")을 지키기 위해 매직 키워드 감지는 **하지 않는다**. 명시 호출만:

```bash
harness ralph --task "기능 X" [--max-iter 10] [--secure] [--live]
harness wait --start                      # 데몬 활성. rate-limit 풀리면 재개
```

## 동작

1. PRD 가 없으면 단계 1·2 (ideate, plan) 만 1회 실행 → `prd.json` 생성.
2. PRD 의 `acceptance` 중 `passes: false` 항목이 있으면 단계 3~7(no-ship) 1사이클.
3. 각 사이클이 끝날 때마다 mock executor 가 1개 AC 를 `passes: true` 로 갱신 (실 LLM 모드면 executor 가 자기 보고).
4. 모든 AC 가 PASS → 단계 7 ship (또는 --no-ship 옵션).
5. 매 사이클 후 `progress.txt` 에 학습 누적.

## 안전 가드

- 매 사이클 후 사용자 룰의 "확인 후 실행" 게이트가 발동하는 작업이 있으면 **데몬 정지** + HUMAN_GATE.
- `--max-iter` (기본 5) 도달 → 정지.
- HARNESS_DAILY_COST_CAP_USD 도달 → 정지 (Day 7 의 costs.jsonl 누적 합산).
- critical 발견 → 즉시 HUMAN_GATE.

## Stop 훅과의 결합

`hooks/scripts/persistent-mode.mjs` 가 세션 종료 시 `.harness/state/sessions/<id>/active` 를 본다. ralph 모드일 때만 active 플래그가 박힘 → wakeup.json drop. `harness wait --start` 데몬이 wakeup 을 폴링해서 외부 레이트 리밋 풀린 시점에 다시 시작.

## ScheduleWakeup 결합 (Claude Code 안에서 호출 시)

Claude Code 안에서 `/ralph` 호출하면 SkillUse 훅이 자동 ScheduleWakeup 으로 일정 간격 반복을 등록한다. 이 부분은 Day 9~10 의 GitHub Actions 통합과 별개 — 로컬 영속과 GH Actions 영속은 같은 prd.json 위에서 동작.

## 비활성 (안전 디폴트)

- 글로벌 매직 키워드 감지 OFF (CLAUDE.md 명시).
- `harness ralph` 명시 호출 또는 `/ralph` 슬래시만 활성.
- 어떤 자연어 입력도 자동 활성하지 않는다.
