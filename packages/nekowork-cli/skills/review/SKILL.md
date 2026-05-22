---
name: review
description: "claude-led-codex-review 단계 4 (self-review) 실행. critical / high 만 잡는다."
origin: harness-core
level: 2
prerequisites: [tdd-workflow]
conflicts: []
tags: [review, self]
---

# review (self)

Claude self-review 단계. code-reviewer 에이전트(opus, ro)를 호출해 git diff 를 본다. 출력은 표준 핸드오프 JSON.

## 호출

```bash
nekowork self-review                  # 단독
# claude-led-codex-review 의 단계 4 로 자동 호출됨
```

## 입력

- `git diff base...HEAD`
- `prd-<id>.md`
- gateguard 가 남긴 사실 노트 (`.harness/state/sessions/<id>/facts/<file>.md`)

## 출력

`handoffs/04-self-review.md` (마크다운 5필드 + 부속 JSON) — `schemas/handoff.schema.json` 준수.

## verdict 매핑

- 1+ critical → `block`
- high 만 → `approve_with_fixes`
- medium 이하만 → `approve`

## 다음 단계 라우팅

- `block` → executor 재호출, round++
- `approve_with_fixes` → 자동 fix → 재리뷰
- `approve` → 단계 5 codex-review 로 진행
