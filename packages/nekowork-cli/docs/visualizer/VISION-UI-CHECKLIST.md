# VISION-UI-CHECKLIST

> **Owner**: Phase 1.0 PR reviewer. 본 체크리스트의 5항목은 visualizer PR 머지 전 reviewer 가 manually verify 한 결과를 PR review 코멘트에 첨부한다.
>
> 출처: design doc Phase 1.0 Success Criteria + plan D12 lock (2026-05-23).
> 핵심 원칙 (VISION.md): **"LLM 의견은 verdict 가 아니다"** — visualizer 가 이 원칙을 시각적으로 침해하지 않도록 5항목으로 가드.

## 1. advisor-only 라벨 — AI 출력이 verdict 처럼 보이지 않는다

**Why**: Claude/Codex review 는 advisor 출력이지 verdict 가 아니다. UI 가 LLM 의견을 NEKOWORK rule verdict 와 동급으로 보이게 만들면 wedge 메시지가 무너진다.

**Verify (DOM)**:
- Claude review section 의 root 요소에 `data-source="advisor"` 어트리뷰트 존재.
- 시각 라벨 "Advisor: Claude" 또는 "Advisor: Codex" 가 section heading 옆에 명시.
- screen reader 읽을 때 "advisor" 단어가 verdict 보다 먼저 들림.

**Pass 기준**: 위 3항목 모두 DOM 에 박혀 있음.

## 2. NEKOWORK rule verdict 의 시각 위계 우선 — Claude LGTM 보다 강하게 표시

**Why**: same frame 에 Claude LGTM 과 NEKOWORK BLOCK 이 동시 표시될 때, 메인테이너의 첨 1초 시선이 NEKOWORK verdict 로 가야 wedge 메시지 ("Claude said LGTM. NEKOWORK blocked.") 가 자연 전달.

**Verify (screenshot + DOM)**:
- NEKOWORK verdict 의 font-size ≥ Claude review verdict 의 1.25× (또는 visual weight 가 명확히 위).
- color contrast: NEKOWORK BLOCK 의 색이 background 와 contrast ratio ≥ 7:1 (WCAG AAA). Claude LGTM 의 색은 AA (4.5:1) 까지 허용 — 위계 차이.
- screenshot 비교: above-the-fold 영역 (vh 50%) 안에서 NEKOWORK verdict 가 Claude LGTM 보다 위쪽 또는 왼쪽 (LTR 시선 흐름 첫 도착점).

**Pass 기준**: 3항목 중 최소 2항목 확인.

## 3. decision.json 이 1차 시각 우선 — evidence chain 가시

**Why**: NEKOWORK 의 진실원은 `decision.json` + `evidence/*.json`. UI 가 LLM debate / advisor 출력을 1차 시각 우선으로 두면 진실원이 부차로 밀린다.

**Verify (DOM)**:
- `decision.json` 의 `verdict` 필드가 page 의 above-the-fold 안에 표시.
- `decision.json` 의 `evidence[]` 각 항목이 verdict 의 직접 옆 (inline) 또는 즉 below (1 viewport 안) 에 표시.
- 각 evidence 항목에 rule ID + file path + line number link 박힘.

**Pass 기준**: 3항목 모두 DOM 에 박혀 있음.

## 4. Claude review attribution 의 정직성 — source 필드 명시

**Why**: `claude-review.json` 의 `source` 필드 (`"manufactured"` | `"recorded"`) 가 UI 에 시각 라벨로 박혀야 정직성 침해 0. 한국 OSS 메인테이너의 trust 직접 영향.

**Verify (DOM)**:
- `source: "manufactured"` 일 때 UI 에 "manufactured demo" 또는 "예시 출력" 시각 라벨.
- `source: "recorded"` 일 때 UI 에 "recorded from PR <attribution>" + attribution 링크.
- 라벨 텍스트가 Claude review verdict 옆 또는 직접 위에 박힘 (사용자가 verdict 읽기 전 source 인지).

**Pass 기준**: 시나리오별로 해당 라벨이 DOM 에 박혀 있음.

## 5. AI debate (Claude vs NEKOWORK) 가 verdict 처럼 보이지 않음 — 비교 frame 의 균형

**Why**: visualizer 의 핵 narrative 는 "Claude said LGTM. NEKOWORK blocked." 의 conflict frame. 단 두 출력이 시각적으로 동등하게 보이면 사용자가 "둘이 의견이 다르네 — 누가 맞나" 로 인지하고 wedge 가 무너진다. NEKOWORK 가 rule + evidence 기반 verdict, Claude 는 advisor 라는 위계가 시각으로 명확해야.

**Verify (DOM + screenshot)**:
- 비교 frame 안에서 NEKOWORK column 이 Claude column 보다 visual weight 우위 (size, color, badge).
- Claude column 에 "Advisor" badge, NEKOWORK column 에 "Rule + Evidence" badge.
- 두 column 의 background color 가 명확히 다름 (NEKOWORK = critical/blocked tone, Claude = neutral/info tone).

**Pass 기준**: 3항목 중 최소 2항목 확인.

## Reviewer 코멘트 템플릿

PR review 시 다음 형식으로 첨부:

```markdown
### VISION-UI-CHECKLIST 결과 (Phase 1.0 visualizer PR)

- [x] 1. advisor-only 라벨 — PASS (data-source 어트리뷰트 확인)
- [x] 2. NEKOWORK 시각 위계 우선 — PASS (font-size + screenshot 비교)
- [x] 3. decision.json 1차 시각 — PASS (above-the-fold + evidence 인라인)
- [x] 4. attribution 정직성 — PASS (manufactured 라벨 박힘)
- [x] 5. 비교 frame 균형 — PASS (badge + color 차별)

**Verdict**: 5/5 PASS — 머지 가능.
```

5항목 중 1항목이라도 FAIL 시 머지 차단, 해당 항목 수정 후 재 review.

## Follow-up (Phase 1.1 +)

- timeline scrubber 도입 시 위 5항목 재검토 — frame 이 바뀌면 위계 보존 여부 재확인.
- live `.nekowork/` dogfood (Stage 3) 시 본 체크리스트의 audience 가 NEKOWORK 메인테이너 자신으로 바뀌므로 항목 4 (attribution) 의 의미가 달라짐 — Stage 3 entry 직전 본 문서 update.
